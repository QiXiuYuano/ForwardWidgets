/**
 * 御坂弹幕模块，支持自动下载
 * 使用 /search/episodes 接口直接获取分集信息，提高效率
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
 * commentId: 弹幕ID，Optional。在搜索到弹幕列表后实际加载时会携带
 * animeId: 动漫ID，Optional。在搜索到动漫列表后实际加载时会携带
 */

WidgetMetadata = {
  id: "misaka.danmu.download",
  title: "Misaka弹幕服务",
  version: "1.0.1",
  requiredVersion: "0.0.2",
  description: "Misaka弹幕服务模块，支持调用、下载弹幕数据",
  author: "QiXiuYuano",
  site: "https://github.com/QiXiuYuano/ForwardWidgets",
  globalParams: [
    {
      name: "server",
      title: "弹幕服务器",
      type: "input",
      placeholders: [
        {
          title: "服务器地址",
          value: "https://api.dandanplay.net",
        },
      ],
    },
    {
      name: "api_key",
      title: "外部API Key",
      type: "input",
      placeholders: [
        {
          title: "API Key",
          value: "",
        },
      ],
    },
  ],
  modules: [
    {
      //id需固定为searchDanmu
      id: "searchDanmu",
      title: "搜索弹幕",
      functionName: "searchDanmu",
      type: "danmu",
      params: [],
    },
    {
      //id需固定为getComments
      id: "getComments",
      title: "获取弹幕",
      functionName: "getCommentsById",
      type: "danmu",
      params: [],
    },
  ],
};

// async function searchDanmu(params) {
//   const { tmdbId, type, title, season, episode, link, videoUrl, server } = params;

//   return {
//     animes: [
//       {
//         "animeId": 1101,
//         "bangumiId": "string",
//         "animeTitle": title,
//         "type": "tvseries",
//         "typeDescription": "string",
//         "imageUrl": "string",
//         "startDate": "2025-09-01T15:00:00.189Z",
//         "episodeCount": 12,
//         "rating": 0,
//         "isFavorited": true
//       }
//     ]
//   };
// }

async function searchDanmu(params) {
  const { tmdbId, type, title, season, episode, server } = params;

  let queryTitle = title;

  if (season) {
    queryTitle = `${title} S${season}`;
  }

  let searchUrl = `${server}/api/v2/search/episodes?anime=${queryTitle}`;
  if (episode) {
    searchUrl += `&episode=${episode}`;
  }

  // 调用 /search/episodes API - 使用Widget.http.get
  const response = await Widget.http.get(searchUrl, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "ForwardWidgets/1.0.0",
    },
  });

  if (!response) {
    throw new Error("获取数据失败");
  }

  const data = response.data;

  // 检查API返回状态
  if (!data.success) {
    throw new Error(data.errorMessage || "API调用失败");
  }

  // 直接从 /search/episodes 响应中获取番剧和分集信息
  let animes = [];
  if (data.animes && Array.isArray(data.animes) && data.animes.length > 0) {
    // 根据类型过滤番剧
    animes = data.animes.filter((anime) => {
      if (
        (anime.type === "tvseries" || anime.type === "web") &&
        type === "tv"
      ) {
        return true;
      } else if (anime.type === "movie" && type === "movie") {
        return true;
      } else {
        return false;
      }
    });
  }
  return {
    animes: animes,
  };
}

async function getCommentsById(params) {
  const { commentId, server, tmdbId, type, title, season, episode, api_key } =
    params;

  let queryTitle = title;

  // 如果有season参数，调整title格式为 "title S{season}"
  if (season) {
    queryTitle = `${title} S${season}`;
  }

  let searchUrl = `${server}/api/v2/search/episodes?anime=${queryTitle}`;
  if (episode) {
    searchUrl += `&episode=${episode}`;
  }

  // 调用 /search/episodes API - 使用Widget.http.get
  const response = await Widget.http.get(searchUrl, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "ForwardWidgets/1.0.0",
    },
  });

  if (!response) {
    throw new Error("获取数据失败");
  }

  const searchData = response.data;

  // 检查API返回状态
  if (!searchData.success) {
    throw new Error(searchData.errorMessage || "API调用失败");
  }

  if (searchData.animes && Array.isArray(searchData.animes) &&
    searchData.animes.length > 0) {
    const result = await getCommentsFromServer({
      ...params,
      searchData,
    });
    if (result) {
      return result;
    }
  }

  console.log("未找到相关剧集，触发弹幕下载");
    
    // 立即返回提示弹幕给用户
    const promptDanmu = generateDanmu("【御坂弹幕模块】：未找到相关剧集，已触发弹幕下载", 1);
    
    // 异步执行下载和重试流程
    (async () => {
      try {
        // 从server参数中提取danmu_server_host
        let danmu_server_host;
        try {
          danmu_server_host = server.match(/^(https?:\/\/[^/]+)/i)[1];
        } catch (e) {
          console.error("无效的服务器地址");
          return;
        }
        if (!api_key) {
          console.error("API Key未配置");
          return;
        }

        // 触发弹幕下载
        const downloadResult = await downloadDanmu(params);

        // 弹幕下载成功后，使用渐进式重试机制获取弹幕
        if (downloadResult.success) {
          console.log(`弹幕下载成功，尝试获取弹幕内容`);
          const retryResult = await retryGetDanmuAfterDownload({
            ...params,
            downloadResult,
          });
          
          // 如果获取到弹幕，可以在这里处理结果
          if (retryResult) {
            console.log(`成功获取到下载的弹幕`);
          }
        } else {
          console.error(`弹幕下载失败: ${downloadResult.message}`);
        }
      } catch (error) {
        console.error(`处理过程中出错:`, error);
      }
    })();
    
    // 立即返回提示弹幕
    return promptDanmu;
}

async function getCommentsFromServer(params) {
  const { searchData, server, tmdbId, type, title, season, episode } = params;

  let animes = [];
  animes = searchData.animes.filter((anime) => {
    if ((anime.type === "tvseries" || anime.type === "web") && type === "tv") {
      return true;
    } else if (anime.type === "movie" && type === "movie") {
      return true;
    } else {
      return false;
    }
  });

  let commentId;
  const anime = animes[0];
  if (anime.episodes && anime.episodes.length > 0) {
    const firstEpisode = anime.episodes[0];
    console.log(
      `找到分集: ${firstEpisode.episodeTitle} (ID: ${firstEpisode.episodeId})`
    );
    commentId = firstEpisode.episodeId;
  } else {
    console.log("未找到分集信息");
    return null;
  }

  if (commentId) {
    // 调用弹弹play弹幕API - 使用Widget.http.get
    const response = await Widget.http.get(
      `${server}/api/v2/comment/${commentId}?withRelated=true&chConvert=1`,
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ForwardWidgets/1.0.0",
        },
      }
    );

    if (!response) {
      throw new Error("获取数据失败");
    }

    return response.data;
  }
  return null;
}

/**
 * 弹幕下载函数
 */
async function downloadDanmu(params) {
  const { tmdbId, type, title, season, episode, danmu_server_host, api_key } =
    params;

  // 确定媒体类型
  const mediaType = type === "movie" ? "movie" : "tv_series";

  try {
    // 定义搜索策略
    let searchType, searchTerm;
    if (tmdbId) {
      searchType = "tmdb";
      searchTerm = tmdbId;
    } else {
      searchType = "keyword";
      searchTerm = title;
    }
    const result = await callImportAutoAPI({
      ...params,
      danmu_server_host,
      searchType,
      searchTerm,
      mediaType,
    });

    if (result.success) {
      console.log(`[调试] ${strategy.name}搜索成功`);

      // 调用弹幕下载API后，必须监控任务状态直到完成
      const downloadResult = await waitForDownloadCompletion(
        result.data.taskId,
        params
      );
      return downloadResult;
    }

    // 所有策略都失败了
    throw new Error("弹幕下载失败：所有搜索策略都未成功");
  } catch (error) {
    console.error(`[错误] 弹幕下载错误:`, error);
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
    mediaType,
  } = params;

  // 构建请求URL
  const baseUrl = `${danmu_server_host}/api/control/import/auto`;
  const paramsObj = new URLSearchParams({
    searchType,
    searchTerm,
    api_key,
  });

  // 添加可选参数
  if (season) {
    paramsObj.append("season", season);
  }

  if (episode) {
    paramsObj.append("episode", episode);
  }

  if (mediaType) {
    paramsObj.append("mediaType", mediaType);
  }

  const requestUrl = `${baseUrl}?${paramsObj.toString()}`;

  console.log(`[调试] 弹幕下载请求URL:`, requestUrl);

  try {
    const response = await Widget.http.post(requestUrl, null, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ForwardWidgets/1.0.0",
      },
      timeout: 30, // 30秒超时，因为导入可能需要时间
    });

    console.log(`[调试] 弹幕服务端响应:`, response.data);

    // 检查响应状态
    if (response.status === 202) {
      return {
        success: true,
        data: response.data,
        searchType,
        searchTerm,
      };
    } else {
      return {
        success: false,
        error: `服务端返回状态码: ${response.status}`,
        searchType,
        searchTerm,
      };
    }
  } catch (error) {
    console.error(`[错误] ${searchType} 搜索请求失败:`, error);
    return {
      success: false,
      error: error.message,
      searchType,
      searchTerm,
    };
  }
}

/*
 * 等待弹幕下载完成并返回最终结果
 */
async function waitForDownloadCompletion(parentTaskId, params) {
  console.log(
    `[调试] 等待弹幕下载完成，外部API自动导入ID: ${parentTaskId}`
  );

  try {
    // 步骤1: 等待外部API自动导入完成
    const parentTaskResult = await waitForTask(
      parentTaskId,
      "外部API自动导入",
      params
    );
    if (!parentTaskResult.success) {
      return {
        success: false,
        message: `外部API自动导入执行失败: ${parentTaskResult.message}`,
        taskId: parentTaskId,
        status: "parent_task_failed",
      };
    }

    // 步骤2: 查找弹幕下载任务
    const subTask = await findDanmuDownloadTask(parentTaskId, params);
    if (!subTask) {
      return {
        success: false,
        message: "未找到弹幕下载子任务，弹幕可能未成功下载",
        parentTaskId,
        status: "sub_task_not_found",
      };
    }

    console.log(`[调试] 找到弹幕下载子任务: ${subTask.taskId}`);

    // 步骤3: 等待子任务完成，这是获取弹幕下载状态的关键步骤
    const subTaskResult = await waitForTask(
      subTask.taskId,
      "弹幕下载任务",
      params
    );

    // 返回弹幕下载的最终结果，包含详细的状态信息
    return {
      success: subTaskResult.success,
      message: subTaskResult.message,
      parentTaskId,
      subTaskId: subTask.taskId,
      subTaskStatus: subTaskResult.status,
      subTaskProgress: subTaskResult.progress,
      subTaskTitle: subTaskResult.title,
      status: "download_completed",
    };
  } catch (error) {
    console.error(`[错误] 等待下载完成出错:`, error);
    return {
      success: false,
      message: `监控弹幕下载过程出错: ${error.message}`,
      taskId: parentTaskId,
      status: "monitor_error",
    };
  }
}

/**
 * 监控任务进度
 */
async function waitForTask(taskId, taskName, params) {
  let attempts = 0;
  const maxAttempts = 30; // 最多等待5分钟(10秒*30次)

  console.log(`[调试] 等待${taskName}完成: ${taskId}`);

  while (attempts < maxAttempts) {
    try {
      const taskInfo = await getTaskStatus(taskId, params);

      console.log(
        `[调试] ${taskName}状态: ${taskInfo.status}, 进度: ${taskInfo.progress}%`
      );

      // 检查任务是否完成
      if (taskInfo.status === "COMPLETED" || taskInfo.status === "已完成") {
        return {
          success: true,
          message: `${taskName}完成`,
          taskId: taskId,
          status: taskInfo.status,
          progress: taskInfo.progress,
          title: taskInfo.title,
          description: taskInfo.description,
        };
      } else if (taskInfo.status === "FAILED" || taskInfo.status === "失败") {
        return {
          success: false,
          message: `${taskName}失败: ${taskInfo.description}`,
          taskId: taskId,
          status: taskInfo.status,
          progress: taskInfo.progress,
          title: taskInfo.title,
          description: taskInfo.description,
        };
      }

      // 等待10秒后再次检查
      await new Promise((resolve) => setTimeout(resolve, 10000));
      attempts++;
    } catch (error) {
      console.log(
        `[调试] 检查${taskName}状态出错:`,
        error.message
      );
      attempts++;
    }
  }

  return {
    success: false,
    message: `${taskName}超时未完成`,
    taskId: taskId,
    status: "timeout",
    progress: 0,
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
    const parentTaskIndex = taskList.findIndex(
      (task) => task.taskId === parentTaskId
    );

    if (parentTaskIndex === -1) {
      console.log(
        `[调试] 未在任务列表中找到外部API自动导入: ${parentTaskId}`
      );
      return null;
    }

    // 外部API自动导入前面一个任务就是子任务（前提是外部API自动导入索引不是0）
    if (parentTaskIndex > 0) {
      const subTask = taskList[parentTaskIndex - 1];
      console.log(
        `[调试] 找到弹幕下载任务ID: ${subTask.taskId}, title: ${subTask.title}`
      );
      return subTask;
    } else {
      console.log(`[调试] 未找到弹幕下载任务`);
      return null;
    }
  } catch (error) {
    console.log(`[调试] 查找弹幕下载任务出错:`, error.message);
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
      timeout: 10,
    });

    const status = response.status;
    const data = response.data;

    if (status === 200) {
      return data;
    } else if (status === 404) {
      throw new Error(`任务不存在: ${taskId}`);
    } else if (status === 401 || status === 403) {
      throw new Error("API认证失败，请检查API密钥");
    } else {
      throw new Error(`HTTP ${status}: ${JSON.stringify(data) || "未知错误"}`);
    }
  } catch (error) {
    throw error;
  }
}

/**
 * 获取最近的任务列表
 */
async function getRecentTasks(limit = 5, params) {
  const { danmu_server_host, api_key } = params;
  const url = `${danmu_server_host}/api/control/tasks?search=&status=all&api_key=${api_key}`;

  try {
    const response = await Widget.http.get(url, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ForwardWidgets/1.0.0",
      },
      timeout: 10,
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

/**
 * 弹幕下载成功后，使用渐进式重试机制获取弹幕
 */
async function retryGetDanmuAfterDownload(params) {
  const { downloadResult, type, title, season, episode, server } = params;

  // 定义重试策略：尝试次数和间隔时间（毫秒）
  const retryStrategy = [
    { delay: 500, description: "立即重试" },
    { delay: 5000, description: "5秒后重试" },
    { delay: 10000, description: "10秒后重试" },
    { delay: 20000, description: "20秒后重试" },
  ];

  // 记录开始时间
  const startTime = Date.now();

  for (let i = 0; i < retryStrategy.length; i++) {
    const { delay, description } = retryStrategy[i];

    // 如果不是第一次尝试，等待指定时间
    if (delay > 0) {
      console.log(`等待 ${delay}ms 后${description}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      console.log(`第 ${i + 1} 次尝试获取下载的弹幕`);

      let queryTitle = title;

      if (season) {
        queryTitle = `${title} S${season}`;
      }

      let searchUrl = `${server}/api/v2/search/episodes?anime=${queryTitle}`;
      if (episode) {
        searchUrl += `&episode=${episode}`;
      }

      // 调用 /search/episodes API - 使用Widget.http.get
      const response = await Widget.http.get(searchUrl, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ForwardWidgets/1.0.0",
        },
      });

      if (!response) {
        throw new Error("获取数据失败");
      }

      const searchData = response.data;

      // 检查API返回状态
      if (!searchData.success) {
        throw new Error(searchData.errorMessage || "API调用失败");
      }

      if (
        searchData.animes &&
        Array.isArray(searchData.animes) &&
        searchData.animes.length > 0
      ) {
        const result = await getCommentsFromServer({
          ...params,
          searchData,
        });
        if (result) {
          return result;
        }

        console.log(`第 ${i + 1} 次尝试未获取到弹幕内容`);
      }
    } catch (error) {
      console.error(`第 ${i + 1} 次尝试获取弹幕时出错:`, error.message);
    }
  }

  // 所有重试都失败了
  const elapsed = Date.now() - startTime;
  console.log(`弹幕下载成功但获取弹幕内容失败，总耗时: ${elapsed}ms`);

  return null;
}

function generateDanmu(message, count) {
  const comments = [];
  const baseP = "1,1,25,16777215,1754803089,0,0,26732601000067074,1"; // 原始 p 字符串

  for (let i = 0; i < count; i++) {
    // 增加 cid
    const cid = i;

    // 修改 p 的第一位数字，加 5
    const pParts = baseP.split(",");
    pParts[0] = (parseInt(pParts[0], 10) + i * 5).toString(); // 每次增加 i * 5
    const updatedP = pParts.join(",");

    // 使用传入的 m 参数
    const m = message;

    // 生成每个弹幕对象
    comments.push({
      cid: cid,
      p: updatedP,
      m: m,
    });
  }

  return {
    count: comments.length,
    comments: comments,
  };
}

