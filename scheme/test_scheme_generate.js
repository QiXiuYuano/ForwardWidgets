// SenPlayer Scheme Rule:
// Import Server Schemes（5.7.0(29)及以上版本支持）
// 中文
// type：   服务器类型（必填），支持填写webdav / smb / ftp / emby / jellyfin / feiniu
// name：  服务器名称（可选）
// note：   服务器备注（可选）
// address：服务器地址，地址中必须包含scheme和host，选填port以及path。例如			     例如https://www.baidu.com:443
// username: 登录名称（可选）
// password: 登录密码（可选）
//
// 多线路支持：emby，jellyfin，feiniu支持添加备用线路，每条线路必须配置两个参数，分别是			线路地址address1, 线路名称address1name，参数中的数字为线路序号
//
// 示例：
// 导入webdav服务器
// senplayer://importserver?type=webdav&name=mywebdav&note=home&address=http://192.168.31.66:5005&username=123&password=456
//
// 导入smb服务器
// senplayer://importserver?type=smb&name=mysmb&note=nas&address=smb://192.168.31.66:445&username=123&password=456
//
// 导入Emby服务器，并同时添加备用线路
// senplayer://importserver?type=emby&name=百度服务&note=&address=https://www.baidu.com:443&username=123&password=456&address1name=百度线路1&address1=https://www.baidu1.com:443&address2name=百度线路2&address2=https://baidu2.com:443



// 批量测试脚本

// 导入处理函数
// const { processSchemeText } = require('./scheme_func.js');
const { parseEmbyInfo, generateSchemeUrl } = require('./local_test.js');

// 定义测试用例
const testCases = [
  {
    name: "测试用例1",
    input: `
    服务器：https://server111.xyz
    用户名：username111
    密码：password111
    `
  },
  {
    name: "测试用例2",
    input: `
    ip线路: http://192.169.1.2:1008
    域名线路: http://server201.com:1009
    直连线路：http://server202:1010
    用户名：username222
    密码：password222
    `
  },
  {
    name: "测试用例3",
    input: `
    · 用户名称 | username333
    · 用户密码 | password333
    · 安全密码 | password000（仅发送一次）
    · 到期时间 | 2025-07-17 19:29:17
    · 当前线路：
    https://line.server301.com
    https://line2.server302.com
    `
  },
  {
    name: "测试用例4",
    input: `
    · 用户名称 | username444
    · 用户密码 | password444
    · 安全密码 | password33（仅发送一次）
    · 到期时间 | 若21天无观看将封禁
    · 当前线路：
    主线路： line.server401.xyz
    https 端口： 443
    `
  },
  {
    name: "测试用例5",
    input: `
    地址: http://line.server501.com:123（其123为端口）
    用户名: username555
    
    密码: password555
    
    ChatId：123456
    
    注册用户名：abc124
    
    到期时间：2035-01-21
    `
  },
  {
    name: "测试用例6",
    input: `
    ▎创建用户成功🎉
    
    · 用户名称 | username666
    · 用户密码 | password666
    · 安全密码 | password000（仅发送一次）
    · 到期时间 | 2025-07-17 19:29:17
    · 当前线路：
    https://line.server601.com
    
    https://line2.server602.com
    
    https://line3.server603.com
    
    https://line4.server604.com
    
    ·【服务器】 - 查看线路和密码
    `
  },
  {
    name: "测试用例7",
    input: `
    ▎创建用户成功🎉
    
    · 用户名称 | username777
    · 用户密码 | password777
    · 安全密码 | password000（仅发送一次）
    · 到期时间 | 若21天无观看将封禁
    · 当前线路：
    主线路： line.server701.com
    http端口：80
    https 端口： 443
    备用线路： line2.server702.com
    https 端口： 443
    
    温馨提示：请注意 http端口是80 https端口443(非80)
    `
  },
  {
    name: "测试用例8",
    input: `
    ChatId：12345
    
    注册用户名：username888
    
    到期时间：2024-12-26
    
    MisakaF：
    
    主机名： https://server801.com/
    端口： 443
    到期时间与机场订阅同步，每4小时执行同步。
    `
  },
  {
    name: "测试用例9",
    input: `
    📢 Emby 信息
    
    📍 用户名: username999
    
    📍 服务器地址：https://server901.com
    `
  }
];

// 执行批量测试
console.log("开始批量测试...\n");

testCases.forEach((testCase, index) => {
  console.log(`=== ${testCase.name} ===`);
  try {
    // const result = processSchemeText(testCase.input);

    const parsedInfo1 = parseEmbyInfo(testCase.input);
    console.log('\\n解析结果:');
    console.log(JSON.stringify(parsedInfo1, null, 2));
    const finalUrl1 = generateSchemeUrl(parsedInfo1);
    console.log('\\n生成的URL:');
    console.log(finalUrl1);
    console.log("测试通过\n");
  } catch (error) {
    console.log(`测试失败: ${error.message}\n`);
  }
});

console.log("批量测试完成。");

// 调试正则表达式的匹配结果
const genericUrl = /((?:\w*线路|服务器|地址|当前线路|主机名|ip\w*|域名\w*|直连\w*)\s*)[|：:]\s*(https?:\/\/[a-zA-Z0-9.\-:]+)/;

// 修正后的正则表达式
const correctedGenericUrl = /((?:\w*线路|服务器|地址|当前线路|主机名|ip\w*|域名\w*|直连\w*))\s*[|：:]\s*(https?:\/\/[a-zA-Z0-9.\-:]+)/;

const testLines = [
  "测试线路: https://test.example.com",
  "新线路: https://new.example.com",
  "ip国际线路: https://ip-global.example.com",
  "域名国内线路: https://domain-cn.example.com",
  "直连快速线路: https://direct-fast.example.com",
  "主机名: https://host.example.com",
  "当前线路: https://current.example.com"
];

console.log("原始正则表达式结果:");
testLines.forEach(line => {
  const match = line.match(genericUrl);
  if (match) {
    console.log(`输入: ${line}`);
    console.log(`标签部分: "${match[1].trim()}"`);
    console.log('---');
  }
});

console.log("\n修正后正则表达式结果:");
testLines.forEach(line => {
  const match = line.match(correctedGenericUrl);
  if (match) {
    console.log(`输入: ${line}`);
    console.log(`标签部分: "${match[1].trim()}"`);
    console.log('---');
  }
});
