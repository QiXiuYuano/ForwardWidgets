/**
 * Misaka弹幕服务模块，支持自动下载
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
      title: "Misaka弹幕服务端地址",
      type: "input",
      placeholders: [
        {
          title: "Misaka弹幕服务端URL",
          value: "https://danmu.yourdomain.com/token",
        },
      ],
    },
    {
      name: "api_key",
      title: "Misaka弹幕服务端外部API Key",
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
      //id需固定为getDetail
      id: "getDetail",
      title: "获取详情",
      functionName: "getDetailById",
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

const LOG_PREFIX = "[Misaka弹幕下载]";

/**
 * 获取弹幕评论函数（主入口函数）
 * 首先尝试搜索弹幕，如果搜索不到则触发下载
 */
async function getCommentsById(params) {
  const { tmdbId, type, title, season, episode, server, api_key } = params;
  console.log("server 参数实际值:", server);
  // 参数验证
  if (!server) {
    throw new Error("弹幕服务器地址未配置");
  }

  if (!api_key) {
    throw new Error("API Key未配置");
  }

  // 从server参数中提取danmu_server_host
  try {
    const danmu_server_host = server.match(/^(https?:\/\/[^/]+)/i)[1];
  } catch (e) {
    throw new Error("无效的服务器地址");
  }

  if (!tmdbId && !title) {
    throw new Error("缺少视频TMDB ID和标题信息");
  }

  console.log(`${LOG_PREFIX} 开始处理弹幕请求: ${title}`);

  try {
    console.log(`${LOG_PREFIX} 尝试搜索弹幕: ${title}`);
    const searchResult = await searchDanmu(params);
    // 首先尝试搜索弹幕
    if (searchResult.animes && searchResult.animes.length > 0) {
      console.log(`${LOG_PREFIX} 搜索到弹幕，直接获取弹幕内容`);
      // 如果搜索到弹幕，直接返回结果
      const anime = searchResult.animes[0];

      // 获取剧集详情
      const episodes = await getDetailById({
        ...params,
        animeId: anime.animeId,
      });
      // console.log(`${LOG_PREFIX} 剧集详情: ${JSON.stringify(episodes)}`);
      if (episodes && episodes.length > 0) {
        // 根据季和集找到对应的剧集
        let targetEpisode = episodes[0]; // 默认使用第一集

        console.log("当前搜索集数episode:", episode);

        if (type === "tv" && season && episode) {
          const matchedEpisode = episodes.find(
            (ep) => String(ep.episodeNumber) === String(episode)
          );

          if (matchedEpisode) {
            targetEpisode = matchedEpisode;
          } else {
            // 如果没有精确匹配的集数，触发弹幕下载而不是使用近似集数
            console.log(`${LOG_PREFIX} 未找到第${episode}集，触发弹幕下载`);

            // 触发弹幕下载
            const downloadResult = await downloadDanmu({
              ...params,
              danmu_server_host, // 已在上面通过server参数提取
              api_key,
            });

            // 弹幕下载成功后，使用渐进式重试机制获取弹幕
            if (downloadResult.success) {
              console.log(`${LOG_PREFIX} 弹幕下载成功，尝试获取弹幕内容`);
              const retryResult = await retryGetDanmuAfterDownload({
                ...params,
                downloadResult,
              });

              return retryResult;
            } else {
              return {
                success: false,
                message: `弹幕下载失败: ${downloadResult.message}`,
                from: "download",
                data: null,
              };
            }
          }
        }

        // 获取弹幕评论
        const comments = await getCommentsByIdInternal({
          ...params,
          commentId: targetEpisode.episodeId,
        });

        return {
          success: true,
          message: "弹幕获取成功",
          from: "search",
          data: comments,
        };
      }
    } else {
      console.log(`${LOG_PREFIX} 未搜索到弹幕，尝试下载弹幕`);
      // 如果没有搜索到弹幕，触发下载
      const downloadResult = await downloadDanmu({
        ...params,
        danmu_server_host, // 已在上面通过server参数提取
        api_key,
      });

      // 弹幕下载成功后，使用渐进式重试机制获取弹幕
      if (downloadResult.success) {
        console.log(`${LOG_PREFIX} 弹幕下载成功，尝试获取弹幕内容`);
        const retryResult = await retryGetDanmuAfterDownload({
          ...params,
          downloadResult,
        });

        return retryResult;
      } else {
        return {
          success: false,
          message: `弹幕下载失败: ${downloadResult.message}`,
          from: "download",
          data: null,
        };
      }
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} 处理弹幕时出错:`, error);
    return {
      success: false,
      message: `处理弹幕时出错: ${error.message}`,
      from: "unknown",
      data: null,
    };
  }
}

/**
 * 弹幕搜索函数
 */
async function searchDanmu(params) {
  const { tmdbId, type, title, season, server } = params;

  let queryTitle = title;

  try {
    // 调用弹弹play格式搜索API
    const response = await Widget.http.get(
      `${server}/api/v2/search/anime?keyword=${encodeURIComponent(queryTitle)}`,
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

    const data = response.data;

    // 检查API返回状态
    if (!data.success) {
      throw new Error(data.errorMessage || "API调用失败");
    }

    // 开始过滤数据
    let animes = [];
    if (data.animes && data.animes.length > 0) {
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

      if (season && type === "tv") {
        // filter season
        const matchedAnimes = animes.filter((anime) => {
          if (anime.animeTitle.includes(queryTitle)) {
            // use space to split animeTitle
            let titleParts = anime.animeTitle.split(" ");
            if (titleParts.length > 1) {
              let seasonPart = titleParts[1];
              // match number from seasonPart
              let seasonIndex = seasonPart.match(/\d+/);
              if (seasonIndex && seasonIndex[0] === season) {
                return true;
              }
              // match chinese number
              let chineseNumber = seasonPart.match(
                /[一二三四五六七八九十壹贰叁肆伍陆柒捌玖拾]+/
              );
              if (
                chineseNumber &&
                convertChineseNumber(chineseNumber[0]) === season
              ) {
                return true;
              }
            }
            return false;
          } else {
            return false;
          }
        });
        if (matchedAnimes.length > 0) {
          animes = matchedAnimes;
        }
      }
    }

    return {
      animes: animes,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} 搜索弹幕时出错:`, error);
    return {
      animes: [],
    };
  }
}

/**
 * 获取详情函数
 */
async function getDetailById(params) {
  const { server, animeId } = params;

  try {
    // `${server}/api/v2/bangumi/A${animeId}`,
    const response = await Widget.http.get(
      `${server}/api/v2/bangumi/${animeId}`,
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

    return response.data.bangumi.episodes;
  } catch (error) {
    console.error(`${LOG_PREFIX} 获取详情时出错:`, error);
    return null;
  }
}

/**
 * 获取弹幕评论函数
 */
async function getCommentsByIdInternal(params) {
  const { server, commentId } = params;

  if (commentId) {
    try {
      // 调用弹弹play弹幕API
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
    } catch (error) {
      console.error(`${LOG_PREFIX} 获取弹幕时出错:`, error);
      return null;
    }
  }

  return null;
}

/**
 * 中文数字转换函数
 */
function convertChineseNumber(chineseNumber) {
  // 如果是阿拉伯数字，直接转换
  if (/^\d+$/.test(chineseNumber)) {
    return Number(chineseNumber);
  }

  // 中文数字映射（简体+繁体）
  const digits = {
    // 简体
    零: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    // 繁体
    壹: 1,
    貳: 2,
    參: 3,
    肆: 4,
    伍: 5,
    陸: 6,
    柒: 7,
    捌: 8,
    玖: 9,
  };

  // 单位映射（简体+繁体）
  const units = {
    // 简体
    十: 10,
    百: 100,
    千: 1000,
    // 繁体
    拾: 10,
    佰: 100,
    仟: 1000,
  };

  let result = 0;
  let current = 0;
  let lastUnit = 1;

  for (let i = 0; i < chineseNumber.length; i++) {
    const char = chineseNumber[i];

    if (digits[char] !== undefined) {
      // 数字
      current = digits[char];
    } else if (units[char] !== undefined) {
      // 单位
      const unit = units[char];

      if (current === 0) current = 1;

      if (unit >= lastUnit) {
        // 更大的单位，重置结果
        result = current * unit;
      } else {
        // 更小的单位，累加到结果
        result += current * unit;
      }

      lastUnit = unit;
      current = 0;
    }
  }

  // 处理最后的个位数
  if (current > 0) {
    result += current;
  }

  return result;
}

/**
 * 弹幕下载函数
 */
async function downloadDanmu(params) {
  const { tmdbId, type, title, season, episode, danmu_server_host, api_key } = params;

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
        searchTerm: tmdbId,
      });
    }

    // 策略2: 关键词搜索 (降级策略)
    searchStrategies.push({
      name: "关键词",
      searchType: "keyword",
      searchTerm: title,
    });

    // 依次尝试每个策略
    for (const strategy of searchStrategies) {
      console.log(
        `${LOG_PREFIX} [调试] 使用${strategy.name}搜索:`,
        strategy.searchTerm
      );

      try {
        const result = await callImportAutoAPI({
          ...params,
          searchType: strategy.searchType,
          searchTerm: strategy.searchTerm,
          mediaType,
        });

        if (result.success) {
          console.log(`${LOG_PREFIX} [调试] ${strategy.name}搜索成功`);

          // 调用弹幕下载API后，必须监控任务状态直到完成
          const downloadResult = await waitForDownloadCompletion(
            result.data.taskId,
            params
          );
          return downloadResult;
        }

        console.log(
          `${LOG_PREFIX} [调试] ${strategy.name}搜索失败，尝试下一个策略`
        );
      } catch (strategyError) {
        console.log(
          `${LOG_PREFIX} [调试] ${strategy.name}搜索出错:`,
          strategyError.message
        );
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
  const { danmu_server_host, api_key, searchType, searchTerm, season, episode, mediaType } = params;

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
    console.error(`${LOG_PREFIX} [错误] ${searchType} 搜索请求失败:`, error);
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
    `${LOG_PREFIX} [调试] 等待弹幕下载完成，外部API自动导入ID: ${parentTaskId}`
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

    console.log(`${LOG_PREFIX} [调试] 找到弹幕下载子任务: ${subTask.taskId}`);

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
    console.error(`${LOG_PREFIX} [错误] 等待下载完成出错:`, error);
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

  console.log(`${LOG_PREFIX} [调试] 等待${taskName}完成: ${taskId}`);

  while (attempts < maxAttempts) {
    try {
      const taskInfo = await getTaskStatus(taskId, params);

      console.log(
        `${LOG_PREFIX} [调试] ${taskName}状态: ${taskInfo.status}, 进度: ${taskInfo.progress}%`
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
        `${LOG_PREFIX} [调试] 检查${taskName}状态出错:`,
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
        `${LOG_PREFIX} [调试] 未在任务列表中找到外部API自动导入: ${parentTaskId}`
      );
      return null;
    }

    // 外部API自动导入前面一个任务就是子任务（前提是外部API自动导入索引不是0）
    if (parentTaskIndex > 0) {
      const subTask = taskList[parentTaskIndex - 1];
      console.log(
        `${LOG_PREFIX} [调试] 找到弹幕下载任务ID: ${subTask.taskId}, title: ${subTask.title}`
      );
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
  const { downloadResult, type, season, episode } = params;

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
      console.log(`${LOG_PREFIX} 等待 ${delay}ms 后${description}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      console.log(`${LOG_PREFIX} 第 ${i + 1} 次尝试获取下载的弹幕`);

      // 再次尝试搜索并获取弹幕
      const retrySearchResult = await searchDanmu(params);
      if (retrySearchResult.animes && retrySearchResult.animes.length > 0) {
        const anime = retrySearchResult.animes[0];

        const episodes = await getDetailById({
          ...params,
          animeId: anime.animeId,
        });

        if (episodes && episodes.length > 0) {
          let targetEpisode = episodes[0];

          // 根据指定的季和集数精确匹配剧集
          if (type === "tv" && season && episode) {
            const matchedEpisode = episodes.find(
              (ep) => String(ep.episodeNumber) === String(episode)
            );

            if (matchedEpisode) {
              targetEpisode = matchedEpisode;
            } else {
              // 如果没有精确匹配的集数，说明下载的弹幕可能还没准备好或者下载失败
              console.log(`${LOG_PREFIX} 重试获取弹幕时未找到第${episode}集`);
              // 继续下一次重试，给系统更多时间准备弹幕数据
              console.log(`${LOG_PREFIX} 继续重试，等待弹幕数据准备完成`);
              continue;
            }
          }

          const comments = await getCommentsByIdInternal({
            ...params,
            commentId: targetEpisode.episodeId,
          });

          return {
            success: true,
            message: "弹幕下载并获取成功",
            from: "download",
            data: comments,
          };
        }
      }

      console.log(`${LOG_PREFIX} 第 ${i + 1} 次尝试未获取到弹幕内容`);
    } catch (error) {
      console.error(
        `${LOG_PREFIX} 第 ${i + 1} 次尝试获取弹幕时出错:`,
        error.message
      );
    }
  }

  // 所有重试都失败了
  const elapsed = Date.now() - startTime;
  console.log(
    `${LOG_PREFIX} 弹幕下载成功但获取弹幕内容失败，总耗时: ${elapsed}ms`
  );

  return {
    success: false,
    message: "弹幕下载成功，但未能获取弹幕内容",
    from: "download",
    data: null,
    retryAttempts: retryStrategy.length,
    totalTimeMs: elapsed,
  };
}
