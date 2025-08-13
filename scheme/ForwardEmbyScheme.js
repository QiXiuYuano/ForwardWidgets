// Forward Emby Scheme 自动解析脚本 for Scriptable（宽松URL过滤版）

function parseEmbyInfo(text) {
  const info = { username: '', password: '', lines: [] };
  const textLines = text.split('\n');
  let lastHost = null;
  const patterns = {
    username: /(?:用户名|用户名称)\s*[|：:]\s*([a-zA-Z0-9\-_]+)/,
    password: /(?:密码|用户密码)\s*[|：:]\s*(\S+)/,
    genericUrl: /((?:当前线路|服务器|地址|主机名|ip[\w\d\u4e00-\u9fa5]*|域名[\w\d\u4e00-\u9fa5]*|直连[\w\d\u4e00-\u9fa5]*|[\w\d\u4e00-\u9fa5]*线路)\s*)[|：:]\s*(https?:\/\/[a-zA-Z0-9.\-:]+)/,
    hostLineUrl: /((?:当前线路|主线路|服务器|地址|主机名|ip[\w\d\u4e00-\u9fa5]*|域名[\w\d\u4e00-\u9fa5]*|直连[\w\d\u4e00-\u9fa5]*|[\w\d\u4e00-\u9fa5]*线路)\s*)[|：:]\s*(\S+)/,
    standaloneUrl: /^(https?:\/\/[a-zA-Z0-9.\-:]+\/?)$/,
    port: /(?:https? 端口|端口)\s*[|：:]\s*(\d{2,5})/,
  };

  for (const line of textLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    let match = trimmedLine.match(patterns.username);
    if (match && !info.username) info.username = match[1];

    match = trimmedLine.match(patterns.password);
    if (match && !info.password) info.password = match[1];

    match = trimmedLine.match(patterns.genericUrl);
    if (match) {
      const label = match[1].trim().replace('当前线路', '线路');
      info.lines.push({ title: label, url: match[2] });
      lastHost = null;
      continue;
    }

    match = trimmedLine.match(patterns.hostLineUrl);
    if (match) {
      const title = match[1].replace('当前线路', '线路');
      const host = match[2];
      if (!host.startsWith('http')) {
        lastHost = { title, host };
      } else {
        info.lines.push({ title, url: host });
        lastHost = null;
      }
      continue;
    }

    match = trimmedLine.match(patterns.port);
    if (match && lastHost) {
      const port = match[1];
      const scheme = (port === '443') ? 'https' : 'http';
      const url = `${scheme}://${lastHost.host}:${port}`;
      info.lines.push({ title: lastHost.title, url });
      lastHost = null;
      continue;
    }

    match = trimmedLine.match(patterns.standaloneUrl);
    if (match) {
      if (!/wiki|faka|notion|t\.me|推荐|续费/.test(trimmedLine)) {
        info.lines.push({ title: '线路', url: match[1] });
        lastHost = null;
      }
      continue;
    }
  }

  // 宽松过滤URL，避免过滤掉合理URL
  info.lines = info.lines.filter(line => {
    if (!line.url) return false;
    let urlStr = line.url.trim();
    // 简单正则校验格式 http(s)://host(:port)?，不严格用new URL
    const simpleUrlPattern = /^https?:\/\/[\w\-.]+(:\d+)?\/?$/i;
    if (!simpleUrlPattern.test(urlStr)) {
      console.log(`格式不符，跳过: ${line.url}`);
      return false;
    }
    return true;
  });

  return info;
  
}


function generateForwardSchemeUrl(info) {
  if (!info.lines || info.lines.length === 0) return null;

  let rawUrl = info.lines[0].url.trim();

  // 用正则解析 scheme://host:port
  const urlMatch = rawUrl.match(/^(https?):\/\/([^\/:]+)(?::(\d+))?/i);
  if (!urlMatch) {
    console.error(`主线路URL格式错误: ${rawUrl}`);
    return null;
  }
  const scheme = urlMatch[1];
  const host = urlMatch[2];
  const port = urlMatch[3] || (scheme === 'https' ? '443' : '80');

  // 下面生成scheme URL逻辑不变
  const genericTitles = ['线路', '地址', '服务器'];
  const firstLineTitle = info.lines[0].title || host;
  const title = genericTitles.includes(firstLineTitle) ? '' : firstLineTitle;

  let url = `forward://import?type=emby&scheme=${scheme}&host=${host}&port=${port}&username=${info.username}&password=${info.password}`;
  if (title) {
    url += `&title=${title}`;
  }
  info.lines.slice(1).forEach((line, index) => {
    const lineIndex = index + 1;
    const normalizedUrl = line.url.endsWith('/') ? line.url.slice(0, -1) : line.url;
    let lineTitle = line.title;
    if (lineTitle === '线路') {
      lineTitle = `备用线路${index + 1}`;
    }
    url += `&line${lineIndex}=${normalizedUrl}&line${lineIndex}title=${lineTitle}`;
  });

  return url;
}

function generateSenPlayerSchemeUrl(info) {
  if (!info.lines || info.lines.length === 0) return null;

  let rawUrl = info.lines[0].url.trim();
  console.log("解析主线路URL", rawUrl);

  // 用正则解析 scheme://host:port(/path)
  const urlMatch = rawUrl.match(/^(https?):\/\/([^\/:]+)(?::(\d+))?(\/.*)?$/i);
  if (!urlMatch) {
    console.error(`主线路URL格式错误: ${rawUrl}`);
    return null;
  }
  const scheme = urlMatch[1];
  const host = urlMatch[2];
  const port = urlMatch[3] || (scheme === 'https' ? '443' : '80');
  const path = urlMatch[4] || '';

  // 构建主地址，包含端口和路径
  let address = `${scheme}://${host}`;
  if (port) {
    address += `:${port}`;
  }
  address += path;

  // 生成senplayer scheme URL，name和note默认为空
  let url = `senplayer://importserver?type=emby&address=${address}&username=${info.username}&password=${info.password}`;

  // 添加备用线路（从第二条线路开始）
  info.lines.slice(1).forEach((line, index) => {
    const lineIndex = index + 1; // 从address1开始
    const lineRawUrl = line.url.trim();

    // 解析备用线路url
    const lineUrlMatch = lineRawUrl.match(/^(https?):\/\/([^\/:]+)(?::(\d+))?(\/.*)?$/i);
    if (!lineUrlMatch) {
      console.warn(`备用线路URL格式错误，跳过: ${lineRawUrl}`);
      return; // 跳过格式错误的备用线路
    }
    const lineScheme = lineUrlMatch[1];
    const lineHost = lineUrlMatch[2];
    const linePort = lineUrlMatch[3] || (lineScheme === 'https' ? '443' : '80');
    const linePath = lineUrlMatch[4] || '';

    // 构建备用线路地址
    let lineAddress = `${lineScheme}://${lineHost}`;
    if (linePort) {
      lineAddress += `:${linePort}`;
    }
    lineAddress += linePath;

    // 线路标题如果是“线路”，替换成“备用线路${index+1}”
    let lineTitle = line.title;
    if (lineTitle === '线路') {
      lineTitle = `备用线路${index + 1}`;
    }

    // 拼接备用线路参数，不编码
    url += `&address${lineIndex}=${lineAddress}&address${lineIndex}name=${lineTitle}`;
  });

  return url;
}




async function run(rawText) {
  const info = parseEmbyInfo(rawText);
  const schemeUrl = generateForwardSchemeUrl(info);
  return schemeUrl;
}

module.exports = { parseEmbyInfo, generateForwardSchemeUrl, run };
