// 模拟 iOS JavaScriptBridge 的 Widget 对象 - 模拟 iOS 环境
global.Widget = {
  http: {
    get: async (url, options) => {
      console.log(`[iOS模拟] HTTP GET: ${url}`);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            ...options.headers,
            'User-Agent': 'ForwardWidgets/1.0.0'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        // if (verbose) {
        //   console.log(`[iOS模拟] API响应:`, JSON.stringify(data, null, 2));
        // }

        // 模拟 iOS 环境：返回 { data: ... } 结构
        return {
          data: data,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries())
        };

      } catch (error) {
        console.error(`[iOS模拟] 请求失败:`, error.message);
        throw error;
      }
    },

    post: async (url, body, options) => {
      console.log(`[iOS模拟] HTTP POST: ${url}`);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            ...options.headers,
            'User-Agent': 'ForwardWidgets/1.0.0'
          },
          body: body
        });

        if (verbose) {
          console.log(`[iOS模拟] POST响应状态:`, response.status);
        }

        let responseData;
        try {
          responseData = await response.json();
        } catch (e) {
          responseData = await response.text();
        }

        if (verbose) {
          console.log(`[iOS模拟] POST响应:`, JSON.stringify(responseData, null, 2));
        }

        // 模拟 iOS 环境：返回 { data: ... } 结构
        return {
          data: responseData,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries())
        };

      } catch (error) {
        console.error(`[iOS模拟] POST请求失败:`, error.message);
        throw error;
      }
    }
  }
};

// 模拟 WidgetMetadata
global.WidgetMetadata = {
  id: "forward.misaka.danmu.download",
  title: "Misaka弹幕自动下载",
  version: "1.0.0",
  description: "测试Misaka弹幕自动下载功能"
};

// 配置变量
const verbose = true;
const danmu_server_host = 'https://danmu';
const api_key = 'xxx';

// 加载 misaka_danmu_download.js 模块
const fs = require('fs');
const misakaDanmuCode = fs.readFileSync('./widgets/misaka_danmu_download.js', 'utf8');
eval(misakaDanmuCode);

async function testMisakaDanmuDownload() {
  console.log('=== 测试 Misaka 弹幕下载功能 ===\n');

  try {
    // 测试1: 连接测试
    console.log('🔗 测试1: 连接测试');
    try {
      const connectionResult = await Widget.http.get(`${danmu_server_host}/api/control/library?api_key=${api_key}`, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ForwardWidgets/1.0.0",
        },
        timeout: 10,
      });

      if (verbose) {
        console.log(`✅ 连接测试: ${connectionResult.success ? '成功' : '失败'} - ${connectionResult.message}`);
      }
    } catch (error) {
      console.log(`❌ 连接测试失败: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 测试: 测试弹幕下载
    console.log('🎬 测试: 下载弹幕测试 ');
    const startTime1 = Date.now();
    try {
      const result1 = await downloadDanmu({
        tmdbId: '223911',
        type: 'tv',
        title: '仙逆',
        season: 1,
        episode: 103,
        danmu_server_host,
        api_key,
        debug_mode: 'true'
      });
      if (verbose) {
        console.log('✅ 完整参数测试结果:', JSON.stringify(result1, null, 2));
      } else {
        console.log(`✅ 完整参数测试: ${result1.success ? '成功' : '失败'} - ${result1.message}`);
        if (result1.taskId) {
          console.log(`📋 任务ID: ${result1.taskId}`);
        }
      }
    } catch (error) {
      console.log(`❌ 完整参数测试失败: ${error.message}`);
    }
    const endTime1 = Date.now();
    downloadTime = endTime1 - startTime1;
    console.log(`⏱️弹幕下载耗时: ${downloadTime/1000}ms`);

    console.log('\n' + '='.repeat(50) + '\n');
    console.log('\n=== 所有测试完成 ===');

  } catch (error) {
    console.error('❌ 测试执行失败:', error);
  }
}


testMisakaDanmuDownload();
