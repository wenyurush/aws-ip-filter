/**
 * AWS IP Range Filter (GUI + API)
 * Hosting: Cloudflare Workers
 */

const AWS_IP_RANGES_URL = 'https://ip-ranges.amazonaws.com/ip-ranges.json';
const CACHE_TTL = 3600 * 4; // 缓存 4 小时

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 如果是根目录且没有任何查询参数，返回图形化界面 (GUI)
    if (url.pathname === '/' && !url.search) {
      return new Response(htmlTemplate(), {
        headers: { 'content-type': 'text/html;charset=UTF-8' },
      });
    }

    // --- API 处理逻辑 ---
    
    // 1. 获取 AWS 数据 (带缓存)
    let awsData = await getAwsIpRanges(ctx);
    if (!awsData) return new Response('Failed to fetch AWS data', { status: 500 });

    // 2. 获取参数
    const targetRegion = url.searchParams.get('region'); 
    const targetService = url.searchParams.get('service'); 
    const format = url.searchParams.get('format') || 'json'; 
    const ipVersion = url.searchParams.get('ipv') || 'all'; 

    // 3. 筛选数据
    let resultIPv4 = awsData.prefixes || [];
    let resultIPv6 = awsData.ipv6_prefixes || [];

    if (targetRegion) {
      const regions = targetRegion.toLowerCase().split(',');
      resultIPv4 = resultIPv4.filter(i => regions.includes(i.region.toLowerCase()));
      resultIPv6 = resultIPv6.filter(i => regions.includes(i.region.toLowerCase()));
    }

    if (targetService) {
      const services = targetService.toUpperCase().split(',');
      resultIPv4 = resultIPv4.filter(i => services.includes(i.service.toUpperCase()));
      resultIPv6 = resultIPv6.filter(i => services.includes(i.service.toUpperCase()));
    }

    // 4. 输出结果
    if (format === 'text') {
      let ipList = [];
      if (ipVersion === 'all' || ipVersion === 'v4') ipList = ipList.concat(resultIPv4.map(i => i.ip_prefix));
      if (ipVersion === 'all' || ipVersion === 'v6') ipList = ipList.concat(resultIPv6.map(i => i.ipv6_prefix));
      return new Response(ipList.join('\n'), { headers: { 'content-type': 'text/plain' } });
    } else {
      // JSON 模式
      const responseData = {
        generated_at: awsData.createDate, // 使用 AWS 原始文件的更新时间
        filters: { region: targetRegion || 'all', service: targetService || 'all' },
        count: { ipv4: resultIPv4.length, ipv6: resultIPv6.length },
        prefixes: (ipVersion === 'all' || ipVersion === 'v4') ? resultIPv4 : [],
        ipv6_prefixes: (ipVersion === 'all' || ipVersion === 'v6') ? resultIPv6 : []
      };
      return new Response(JSON.stringify(responseData, null, 2), {
        headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};

// --- 辅助函数 ---

async function getAwsIpRanges(ctx) {
  const cache = caches.default;
  const cacheKey = new Request(AWS_IP_RANGES_URL);
  let response = await cache.match(cacheKey);
  
  if (!response) {
    try {
      response = await fetch(AWS_IP_RANGES_URL, { headers: { 'User-Agent': 'CF-Worker' } });
      if (!response.ok) throw new Error('Upstream error');
      response = new Response(response.body, response);
      response.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`);
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } catch (e) { return null; }
  }
  return await response.json();
}

// --- 前端 HTML 模板 (Single Page Application) ---
function htmlTemplate() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AWS IP Range Filter</title>
    <style>
        :root { --primary: #2563eb; --bg: #f8fafc; --card: #ffffff; --border: #e2e8f0; --text: #1e293b; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; height: 100vh; display: flex; flex-direction: column; }
        
        .container { max-width: 1400px; margin: 0 auto; width: 100%; flex: 1; display: flex; gap: 20px; overflow: hidden; }
        
        /* 侧边栏样式 */
        .sidebar { width: 350px; background: var(--card); padding: 20px; border-radius: 12px; border: 1px solid var(--border); display: flex; flex-direction: column; gap: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); overflow-y: auto; }
        .control-group { display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; }
        .control-group h3 { margin: 0; font-size: 0.9rem; text-transform: uppercase; color: #64748b; display: flex; justify-content: space-between; align-items: center; }
        
        .search-input { width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.9rem; margin-bottom: 5px; }
        
        .checkbox-list { border: 1px solid var(--border); border-radius: 6px; overflow-y: auto; flex: 1; padding: 5px; background: #fff; }
        .checkbox-item { display: flex; align-items: center; padding: 4px 8px; cursor: pointer; font-size: 0.85rem; }
        .checkbox-item:hover { background: #f1f5f9; }
        .checkbox-item input { margin-right: 8px; }
        
        .actions { display: flex; gap: 10px; margin-top: auto; }
        button { flex: 1; padding: 10px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: 0.2s; }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { opacity: 0.9; }
        .btn-outline { background: transparent; border: 1px solid var(--border); color: #64748b; }
        .btn-outline:hover { background: #f1f5f9; }

        /* 主内容区样式 */
        .main { flex: 1; display: flex; flex-direction: column; gap: 15px; min-width: 0; }
        .header { display: flex; justify-content: space-between; align-items: center; background: var(--card); padding: 15px 20px; border-radius: 12px; border: 1px solid var(--border); }
        .stats { font-size: 0.9rem; color: #64748b; }
        .stats strong { color: var(--text); }
        
        .output-area { flex: 1; background: var(--card); border-radius: 12px; border: 1px solid var(--border); padding: 0; position: relative; overflow: hidden; display: flex; flex-direction: column; }
        .output-toolbar { padding: 10px 20px; border-bottom: 1px solid var(--border); display: flex; gap: 15px; align-items: center; background: #f8fafc; }
        
        textarea { flex: 1; width: 100%; border: none; padding: 20px; font-family: 'SF Mono', Consolas, monospace; font-size: 0.9rem; resize: none; outline: none; background: var(--card); }
        
        .tag { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; margin-left: 5px; }

        /* 移动端适配 */
        @media (max-width: 768px) {
            .container { flex-direction: column; overflow-y: auto; }
            .sidebar { width: 100%; height: auto; max-height: 50vh; }
            body { height: auto; }
            textarea { height: 400px; }
        }
        
        .loading-overlay { position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(255,255,255,0.8); display: flex; justify-content: center; align-items: center; z-index: 100; font-weight: bold; }
    </style>
</head>
<body>

<div id="loader" class="loading-overlay">正在获取 AWS 最新数据...</div>

<div class="container">
    <div class="sidebar">
        <div style="margin-bottom: 10px;">
            <h2 style="margin:0;">AWS IP Filter</h2>
            <div style="font-size: 0.8rem; color: #94a3b8;">Worker Edge Tool</div>
        </div>

        <!-- 地区选择 -->
        <div class="control-group">
            <h3>地区 (Regions) <span id="region-count" class="tag">0</span></h3>
            <input type="text" class="search-input" placeholder="搜索地区 (如: us-east-1)..." onkeyup="filterList('region-list', this.value)">
            <div id="region-list" class="checkbox-list"></div>
        </div>

        <!-- 服务选择 -->
        <div class="control-group">
            <h3>服务 (Services) <span id="service-count" class="tag">0</span></h3>
            <input type="text" class="search-input" placeholder="搜索服务 (如: EC2)..." onkeyup="filterList('service-list', this.value)">
            <div id="service-list" class="checkbox-list"></div>
        </div>

        <div class="actions">
            <button class="btn-outline" onclick="resetFilters()">重置</button>
            <!-- 实际上交互是实时的，这个按钮更多是心理作用，也可以用来强制刷新数据 -->
            <button class="btn-primary" onclick="copyToClipboard()">复制结果</button>
        </div>
    </div>

    <div class="main">
        <div class="header">
            <div>
                <strong>当前筛选结果</strong>
                <span id="result-meta" class="stats" style="margin-left: 10px;"></span>
            </div>
            <div>
                 <select id="ipv-select" onchange="renderResult()" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border);">
                    <option value="all">IPv4 + IPv6</option>
                    <option value="v4">IPv4 Only</option>
                    <option value="v6">IPv6 Only</option>
                </select>
                <select id="format-select" onchange="renderResult()" style="padding: 6px; border-radius: 4px; border: 1px solid var(--border);">
                    <option value="text">纯文本 (CIDR)</option>
                    <option value="json">JSON 格式</option>
                </select>
            </div>
        </div>

        <div class="output-area">
            <textarea id="output" readonly></textarea>
        </div>
    </div>
</div>

<script>
    let fullData = null;
    let selectedRegions = new Set();
    let selectedServices = new Set();

    // 初始化
    window.onload = async () => {
        try {
            // 请求当前 Worker 的 API 接口获取全量 JSON
            const res = await fetch(window.location.href + '?format=json');
            const data = await res.json();
            
            // 合并 v4 和 v6 用于提取元数据
            fullData = {
                ipv4: data.prefixes || [],
                ipv6: data.ipv6_prefixes || [],
                meta: data.generated_at
            };

            initFilters();
            renderResult();
            document.getElementById('loader').style.display = 'none';
        } catch (e) {
            alert('数据加载失败，请检查网络或刷新重试');
        }
    };

    function initFilters() {
        // 提取所有唯一的 Region 和 Service
        const regions = new Set();
        const services = new Set();

        [...fullData.ipv4, ...fullData.ipv6].forEach(item => {
            regions.add(item.region);
            services.add(item.service);
        });

        // 渲染列表
        renderCheckboxList('region-list', Array.from(regions).sort(), selectedRegions, 'region');
        renderCheckboxList('service-list', Array.from(services).sort(), selectedServices, 'service');
        
        updateCounts();
    }

    function renderCheckboxList(containerId, items, selectionSet, type) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            div.innerHTML = \`<label style="width:100%; cursor:pointer; display:flex; align-items:center;">
                <input type="checkbox" value="\${item}" onchange="toggleSelection('\${type}', '\${item}')">
                \${item}
            </label>\`;
            container.appendChild(div);
        });
    }

    function toggleSelection(type, value) {
        const set = type === 'region' ? selectedRegions : selectedServices;
        if (set.has(value)) set.delete(value);
        else set.add(value);
        renderResult();
    }

    // 本地搜索列表项
    function filterList(containerId, searchText) {
        const container = document.getElementById(containerId);
        const items = container.getElementsByClassName('checkbox-item');
        const term = searchText.toLowerCase();
        for (let item of items) {
            const text = item.innerText.toLowerCase();
            item.style.display = text.includes(term) ? 'flex' : 'none';
        }
    }

    function resetFilters() {
        selectedRegions.clear();
        selectedServices.clear();
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        renderResult();
    }

    function renderResult() {
        if (!fullData) return;

        const ipvMode = document.getElementById('ipv-select').value;
        const formatMode = document.getElementById('format-select').value;

        // 核心筛选逻辑
        let v4 = fullData.ipv4;
        let v6 = fullData.ipv6;

        if (selectedRegions.size > 0) {
            v4 = v4.filter(i => selectedRegions.has(i.region));
            v6 = v6.filter(i => selectedRegions.has(i.region));
        }
        
        if (selectedServices.size > 0) {
            v4 = v4.filter(i => selectedServices.has(i.service));
            v6 = v6.filter(i => selectedServices.has(i.service));
        }

        let outputText = '';
        let totalCount = 0;

        if (formatMode === 'text') {
            const list = [];
            if (ipvMode !== 'v6') list.push(...v4.map(i => i.ip_prefix));
            if (ipvMode !== 'v4') list.push(...v6.map(i => i.ipv6_prefix));
            outputText = list.join('\\n');
            totalCount = list.length;
        } else {
            const resultObj = {
                generated_at: fullData.meta,
                filters: {
                    regions: Array.from(selectedRegions),
                    services: Array.from(selectedServices)
                },
                prefixes: (ipvMode !== 'v6') ? v4 : [],
                ipv6_prefixes: (ipvMode !== 'v4') ? v6 : []
            };
            outputText = JSON.stringify(resultObj, null, 2);
            totalCount = ((ipvMode !== 'v6') ? v4.length : 0) + ((ipvMode !== 'v4') ? v6.length : 0);
        }

        document.getElementById('output').value = outputText;
        document.getElementById('result-meta').innerText = \`找到 \${totalCount} 个 IP 段\`;
        updateCounts();
    }
    
    function updateCounts() {
        document.getElementById('region-count').innerText = document.querySelectorAll('#region-list input').length;
        document.getElementById('service-count').innerText = document.querySelectorAll('#service-list input').length;
    }

    function copyToClipboard() {
        const copyText = document.getElementById("output");
        copyText.select();
        document.execCommand("copy");
        const btn = document.querySelector('.btn-primary');
        const originalText = btn.innerText;
        btn.innerText = '已复制!';
        setTimeout(() => btn.innerText = originalText, 1500);
    }
</script>
</body>
</html>`;
}
