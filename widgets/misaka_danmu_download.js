/**
 * 弹幕自动下载模块
 * 目的：视频播放时自动调用弹幕服务端的 /api/control/import/auto 接口下载弹幕
 * 给 module 指定 type 为 danmu 后，默认会携带以下参数：
 * tmdbId: TMDB ID，Optional
 * type: 类型，tv | movie
 * title: 搜索关键词
 * seriesName：剧名，Optional
 * episodeName：集名，Optional
 * airDate：播出日期，Optional
 * runtime：时长，Optional
 * premiereDate：首播日期，Optional
 * season: 季，电影时为空，Optional
 * episode: 集，电影时为空，Optional
 * link: 链接，Optional
 * videoUrl: 视频链接，Optional
 */

WidgetMetadata = {
  id: "forward.misaka.danmu.download",
  title: "Misaka弹幕自动下载",
  version: "1.0.0",
  requiredVersion: "0.0.2",
  description: "自动调用Misaka弹幕服务端API下载弹幕数据",
  author: "Forward",
  site: "https://github.com/QiXiuYuano/ForwardWidgets",
  globalParams: [
    {
      name: "danmu_server_host",
      title: "弹幕服务端地址",
      type: "input",
      placeholders: [
        {
          title: "Misaka 弹幕服务端 URL",
          value: "https://danmu.yourdomain.com",
        },
      ],
    },
    {
      name: "api_key",
      title: "外部 API 密钥(API Key)",
      type: "input",
      placeholders: [
        {
          title: "请输入 API Key",
          value: "",
        },
      ],
    }
  ],
  modules: [
    {
      id: "downloadDanmu",
      title: "下载弹幕",
      functionName: "downloadDanmu",
      type: "danmu",
      params: [],
    },
  ],
};

const LOG_PREFIX = "[Misaka-Danmu-Download]";

/**
 * 主要的弹幕下载函数
 */
async function downloadDanmu(params) {
  const {
    tmdbId,
    type,
    title,
    season,
    episode,
    danmu_server_host,
    api_key
  } = params;

  // 参数验证
  if (!danmu_server_host) {
    throw new Error("弹幕服务端地址未配置");
  }

  if (!api_key) {
    throw new Error("API Key未配置");
  }

  if (!tmdbId && !title) {
    throw new Error("缺少视频TMDB ID和标题信息");
  }

  // 确定媒体类型
  const mediaType = type === "movie" ? "movie" : "tv_series";

  try {
    // 定义搜索策略数组
    const searchStrategies = [];

    // 策略1: 优先使用TMDB ID (最高效)
    if (tmdbId) {
      searchStrategies.push({
        name: "TMDB ID",
        searchType: "tmdb",
        searchTerm: tmdbId
      });
    }

    // 策略2: 关键词搜索 (降级策略)
    searchStrategies.push({
      name: "关键词",
      searchType: "keyword",
      searchTerm: title
    });

    // 依次尝试每个策略
    for (const strategy of searchStrategies) {
        console.log(`${LOG_PREFIX} [调试] 使用${strategy.name}搜索:`, strategy.searchTerm);


      try {
        const result = await callImportAutoAPI({
          ...params,
          searchType: strategy.searchType,
          searchTerm: strategy.searchTerm,
          mediaType
        });

        if (result.success) {
            console.log(`${LOG_PREFIX} [调试] ${strategy.name}搜索成功`);
          
          // 调用弹幕下载API后，必须监控任务状态直到完成
          const downloadResult = await waitForDownloadCompletion(result.data.taskId, params);
          return downloadResult;
        }

          console.log(`${LOG_PREFIX} [调试] ${strategy.name}搜索失败，尝试下一个策略`);

      } catch (strategyError) {
          console.log(`${LOG_PREFIX} [调试] ${strategy.name}搜索出错:`, strategyError.message);
        // 继续尝试下一个策略，不立即抛出错误
      }
    }

    // 所有策略都失败了
    throw new Error("弹幕下载失败：所有搜索策略都未成功");

  } catch (error) {
    console.error(`${LOG_PREFIX} [错误] 弹幕下载错误:`, error);
    throw new Error(`弹幕下载失败: ${error.message}`);
  }
}

/**
 * 调用弹幕服务端的 /api/control/import/auto 接口
 */
async function callImportAutoAPI(params) {
  const {
    danmu_server_host,
    api_key,
    searchType,
    searchTerm,
    season,
    episode,
    mediaType
  } = params;
  // 构建请求URL
  const baseUrl = `${danmu_server_host}/api/control/import/auto`;
  const paramsObj = new URLSearchParams({
    searchType,
    searchTerm,
    api_key
  });

  // 添加可选参数
  if (season) {
    paramsObj.append('season', season);
  }

  if (episode) {
    paramsObj.append('episode', episode);
  }

  if (mediaType) {
    paramsObj.append('mediaType', mediaType);
  }

  const requestUrl = `${baseUrl}?${paramsObj.toString()}`;


    console.log(`${LOG_PREFIX} [调试] 弹幕下载请求URL:`, requestUrl);


  try {
    const response = await Widget.http.post(requestUrl, null, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ForwardWidgets/1.0.0",
      },
      timeout: 30, // 30秒超时，因为导入可能需要时间
    });

      console.log(`${LOG_PREFIX} [调试] 弹幕服务端响应:`, response.data);


    // 检查响应状态
    if (response.status === 202) {
      return {
        success: true,
        data: response.data,
        searchType,
        searchTerm
      };
    } else {
      return {
        success: false,
        error: `服务端返回状态码: ${response.status}`,
        searchType,
        searchTerm
      };
    }

  } catch (error) {

      console.error(`${LOG_PREFIX} [错误] ${searchType} 搜索请求失败:`, error);

    return {
      success: false,
      error: error.message,
      searchType,
      searchTerm
    };
  }
}

/*
 * 等待弹幕下载完成并返回最终结果
 */
async function waitForDownloadCompletion(parentTaskId, params) {

    console.log(`${LOG_PREFIX} [调试] 等待弹幕下载完成，外部API自动导入ID: ${parentTaskId}`);
  
  try {
    // 步骤1: 等待外部API自动导入完成
    const parentTaskResult = await waitForTask(parentTaskId, "外部API自动导入", params);
    if (!parentTaskResult.success) {
      return {
        success: false,
        message: `外部API自动导入执行失败: ${parentTaskResult.message}`,
        taskId: parentTaskId,
        status: "parent_task_failed"
      };
    }
    
    // 步骤2: 查找弹幕下载任务
    const subTask = await findDanmuDownloadTask(parentTaskId, params);
    if (!subTask) {
      return {
        success: false,
        message: "未找到弹幕下载子任务，弹幕可能未成功下载",
        parentTaskId,
        status: "sub_task_not_found"
      };
    }
    
      console.log(`${LOG_PREFIX} [调试] 找到弹幕下载子任务: ${subTask.taskId}`);
    
    // 步骤3: 等待子任务完成，这是获取弹幕下载状态的关键步骤
    const subTaskResult = await waitForTask(subTask.taskId, "弹幕下载任务", params);
    
    // 返回弹幕下载的最终结果，包含详细的状态信息
    return {
      success: subTaskResult.success,
      message: subTaskResult.message,
      parentTaskId,
      subTaskId: subTask.taskId,
      subTaskStatus: subTaskResult.status,
      subTaskProgress: subTaskResult.progress,
      subTaskTitle: subTaskResult.title,
      status: "download_completed"
    };
    
  } catch (error) {
    console.error(`${LOG_PREFIX} [错误] 等待下载完成出错:`, error);
    return {
      success: false,
      message: `监控弹幕下载过程出错: ${error.message}`,
      taskId: parentTaskId,
      status: "monitor_error"
    };
  }
}

/**
 * 监控任务进度
 */
async function waitForTask(taskId, taskName, params) {
  let attempts = 0;
  const maxAttempts = 12; // 最多等待2分钟(10秒*12次)
  
    console.log(`${LOG_PREFIX} [调试] 等待${taskName}完成: ${taskId}`);
  
  while (attempts < maxAttempts) {
    try {
      const taskInfo = await getTaskStatus(taskId, params);
      
        console.log(`${LOG_PREFIX} [调试] ${taskName}状态: ${taskInfo.status}, 进度: ${taskInfo.progress}%`);
      
      // 检查任务是否完成
      if (taskInfo.status === 'COMPLETED' || taskInfo.status === '已完成') {
        return {
          success: true,
          message: `${taskName}完成`,
          taskId: taskId,
          status: taskInfo.status,
          progress: taskInfo.progress,
          title: taskInfo.title,
          description: taskInfo.description
        };
      } else if (taskInfo.status === 'FAILED' || taskInfo.status === '失败') {
        return {
          success: false,
          message: `${taskName}失败: ${taskInfo.description}`,
          taskId: taskId,
          status: taskInfo.status,
          progress: taskInfo.progress,
          title: taskInfo.title,
          description: taskInfo.description
        };
      }
      
      // 等待10秒后再次检查
      await new Promise(resolve => setTimeout(resolve, 10000));
      attempts++;
    } catch (error) {
        console.log(`${LOG_PREFIX} [调试] 检查${taskName}状态出错:`, error.message);
      attempts++;
    }
  }
  
  return {
    success: false,
    message: `${taskName}超时未完成`,
    taskId: taskId,
    status: "timeout",
    progress: 0
  };
}

/**
 * 查找弹幕下载子任务
 */
async function findDanmuDownloadTask(parentTaskId, params) {

  try {
    // 获取最近的任务列表
    const taskList = await getRecentTasks(5, params);

    // 找到外部API自动导入在列表中的索引
    const parentTaskIndex = taskList.findIndex(task => task.taskId === parentTaskId);

    if (parentTaskIndex === -1) {

        console.log(`${LOG_PREFIX} [调试] 未在任务列表中找到外部API自动导入: ${parentTaskId}`);

      return null;
    }

    // 外部API自动导入前面一个任务就是子任务（前提是外部API自动导入索引不是0）
    if (parentTaskIndex > 0) {
      const subTask = taskList[parentTaskIndex - 1];

        console.log(`${LOG_PREFIX} [调试] 找到弹幕下载任务ID: ${subTask.taskId}, title: ${subTask.title}`);

      return subTask;
    } else {

        console.log(`${LOG_PREFIX} [调试] 未找到弹幕下载任务`);

      return null;
    }
    
  } catch (error) {

      console.log(`${LOG_PREFIX} [调试] 查找弹幕下载任务出错:`, error.message);

    return null;
  }
}

/**
 * 获取任务状态
 */
async function getTaskStatus(taskId, params) {
  const { danmu_server_host, api_key } = params;
  
  try {
    const url = `${danmu_server_host}/api/control/tasks/${taskId}?api_key=${api_key}`;
    const response = await Widget.http.get(url, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ForwardWidgets/1.0.0",
      },
      timeout: 10
    });
    
    const status = response.status;
    const data = response.data;

    if (status === 200) {
      return data;
    } else if (status === 404) {
      throw new Error(`任务不存在: ${taskId}`);
    } else if (status === 401 || status === 403) {
      throw new Error('API认证失败，请检查API密钥');
    } else {
      throw new Error(`HTTP ${status}: ${JSON.stringify(data) || '未知错误'}`);
    }
  } catch (error) {
    throw error;
  }
}

/**
 * 获取最近的任务列表
 */
async function getRecentTasks(limit = 5) {
  const { danmu_server_host, api_key } = params;
  const url = `${danmu_server_host}/api/control/tasks?search=&status=all&api_key=${api_key}`;

  try {
    const response = await Widget.http.get(url, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ForwardWidgets/1.0.0",
      },
      timeout: 10
    });
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const tasks = response.data;
    return tasks.slice(0, limit);
  } catch (error) {
    throw error;
  }
}
