/**
 * Emby 配置文本解析与 Scheme URL 生成脚本
 * 
 * 功能：
 * 1. 从输入的配置文本中提取用户名、密码及线路信息
 * 2. 生成适用于 Forward App 和 SenPlayer App 的导入 Scheme URL
 * 
 * 说明：
 * - 脚本仅在本地运行，数据不会上传
 * - 支持多条线路，自动区分主线路与备用线路
 * 
 * 作者：https://t.me/GeNie0x00
 * 转载请保留来源
 */

function parseEmbyInfo(configText) {
  const embyInfo = { username: '', password: '', lines: [] };
  const textLines = configText.split('\n');
  let lastHost = null;

  const regexPatterns = {
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

    let match = trimmedLine.match(regexPatterns.username);
    if (match && !embyInfo.username) embyInfo.username = match[1];

    match = trimmedLine.match(regexPatterns.password);
    if (match && !embyInfo.password) embyInfo.password = match[1];

    match = trimmedLine.match(regexPatterns.genericUrl);
    if (match) {
      const label = match[1].trim().replace('当前线路', '线路');
      embyInfo.lines.push({ title: label, url: match[2] });
      lastHost = null;
      continue;
    }

    match = trimmedLine.match(regexPatterns.hostLineUrl);
    if (match) {
      const title = match[1].replace('当前线路', '线路');
      const host = match[2];
      if (!host.startsWith('http')) {
        lastHost = { title, host };
      } else {
        embyInfo.lines.push({ title, url: host });
        lastHost = null;
      }
      continue;
    }

    match = trimmedLine.match(regexPatterns.port);
    if (match && lastHost) {
      const port = match[1];
      const scheme = (port === '443') ? 'https' : 'http';
      const url = `${scheme}://${lastHost.host}:${port}`;
      embyInfo.lines.push({ title: lastHost.title, url });
      lastHost = null;
      continue;
    }

    match = trimmedLine.match(regexPatterns.standaloneUrl);
    if (match) {
      if (!/wiki|faka|notion|t\.me|推荐|续费/.test(trimmedLine)) {
        embyInfo.lines.push({ title: '线路', url: match[1] });
        lastHost = null;
      }
      continue;
    }
  }

  // 过滤格式不符合的 URL，简单校验 http(s)://host(:port)?
  embyInfo.lines = embyInfo.lines.filter(line => {
    if (!line.url) return false;
    const urlStr = line.url.trim();
    const simpleUrlPattern = /^https?:\/\/[\w\-.]+(:\d+)?\/?$/i;
    if (!simpleUrlPattern.test(urlStr)) {
      console.log(`格式不符，跳过: ${line.url}`);
      return false;
    }
    return true;
  });

  return embyInfo;
}

function generateForwardSchemeUrl(embyInfo) {
  if (!embyInfo.lines || embyInfo.lines.length === 0) return null;

  const rawUrl = embyInfo.lines[0].url.trim();

  // 正则解析 scheme://host:port
  const urlMatch = rawUrl.match(/^(https?):\/\/([^\/:]+)(?::(\d+))?/i);
  if (!urlMatch) {
    console.error(`主线路URL格式错误: ${rawUrl}`);
    return null;
  }
  const scheme = urlMatch[1];
  const host = urlMatch[2];
  const port = urlMatch[3] || (scheme === 'https' ? '443' : '80');

  const genericTitles = ['线路', '地址', '服务器'];
  const firstLineTitle = embyInfo.lines[0].title || host;
  const title = genericTitles.includes(firstLineTitle) ? '' : firstLineTitle;

  let url = `forward://import?type=emby&scheme=${scheme}&host=${host}&port=${port}&username=${embyInfo.username}&password=${embyInfo.password}`;
  if (title) {
    url += `&title=${title}`;
  }

  embyInfo.lines.slice(1).forEach((line, index) => {
    const lineIndex = index + 1;
    const normalizedUrl = line.url.endsWith('/') ? line.url.slice(0, -1) : line.url;
    let lineTitle = line.title;
    if (lineTitle === '线路') {
      lineTitle = `备用线路${lineIndex}`;
    }
    url += `&line${lineIndex}=${normalizedUrl}&line${lineIndex}title=${lineTitle}`;
  });

  return url;
}

function generateSenPlayerSchemeUrl(embyInfo) {
  if (!embyInfo.lines || embyInfo.lines.length === 0) return null;

  const rawUrl = embyInfo.lines[0].url.trim();
  console.log("解析主线路URL", rawUrl);

  // 正则解析 scheme://host:port(/path)
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
  let url = `senplayer://importserver?type=emby&address=${address}&username=${embyInfo.username}&password=${embyInfo.password}`;

  // 添加备用线路（从第二条线路开始）
  embyInfo.lines.slice(1).forEach((line, index) => {
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
      lineTitle = `备用线路${lineIndex}`;
    }

    // 拼接备用线路参数，不编码
    url += `&address${lineIndex}=${lineAddress}&address${lineIndex}name=${lineTitle}`;
  });

  return url;
}

async function run(configText) {
  const embyInfo = parseEmbyInfo(configText);
  return {
    forward: generateForwardSchemeUrl(embyInfo),
    senplayer: generateSenPlayerSchemeUrl(embyInfo)
  };
}

module.exports = { parseEmbyInfo, generateForwardSchemeUrl, generateSenPlayerSchemeUrl, run };
