WidgetMetadata = {
    id: "BilibiliUP",
    title: "B站UP主视频",
    description: "获取关注的B站UP主视频",
    author: "Qixiuyuan",
    site: "https://github.com/QiXiuYuano/ForwardWidgets",
    version: "1.0.0",
    requiredVersion: "0.0.1",
    modules: [
      // 热门影片模块
      // {
      //   title: "热门影片",
      //   description: "热门影片",
      //   requiresWebView: false,
      //   functionName: "loadPage",
      //   params: [
      //     {
      //       name: "url",
      //       title: "列表地址",
      //       type: "constant",
      //       description: "列表地址",
      //       value:
      //         "https://jable.tv/hot/?mode=async&function=get_block&block_id=list_videos_common_videos_list",
      //     },
      //     {
      //       name: "sort_by",
      //       title: "排序",
      //       type: "enumeration",
      //       description: "排序",
      //       enumOptions: [
      //         { title: "所有时间", value: "video_viewed" },
      //         { title: "本月热门", value: "video_viewed_month" },
      //         { title: "本周热门", value: "video_viewed_week" },
      //         { title: "今日热门", value: "video_viewed_today" },
      //       ],
      //     },
      //     { name: "from", title: "页码", type: "page", description: "页码", value: "1" },
      //   ],
      // },
      {
        title: "UP主投稿视频",
        description: "获取指定UP主的投稿视频",
        requiresWebView: false,
        functionName: "loadBilibiliUpVideos",
        params: [
          {
            name: "mid",
            title: "UP主UID",
            type: "constant",
            description: "UP主UID",
            value: "37754047"
          }
        ]
      }
    ]
};

async function loadBilibiliUpVideos(params = {}) {
  const mid = params.mid || "37754047";
  // 推荐使用B站API接口获取投稿列表
  const url = `https://api.bilibili.com/x/space/arc/search?mid=${mid}&ps=30&tid=0&pn=1&order=pubdate&jsonp=jsonp`;
  const response = await Widget.http.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": `https://space.bilibili.com/${mid}/video`
    }
  });
  if (!response || !response.data || !response.data.data) {
    throw new Error("无法获取UP主投稿视频数据");
  }
  const vlist = response.data.data.list.vlist;
  const items = vlist.map(video => ({
    id: video.bvid,
    type: "url",
    title: video.title,
    durationText: video.length,
    backdropPath: video.pic,
    link: `https://www.bilibili.com/video/${video.bvid}`
  }));
  return [{
    id: "bilibili_up_videos",
    type: "web",
    title: "UP主投稿视频",
    childItems: items
  }];
}

async function search(params = {}) {
    const url = `https://jable.tv/search/${params.keyword}/?mode=async&function=get_block&block_id=list_videos_videos_list_search_result&q=${params.keyword}`;
    params.url = url;
    return await loadPage(params);
  }
  
  async function loadPage(params = {}) {
    const sections = await loadPageSections(params);
    const items = sections.flatMap((section) => section.childItems);
    return items;
  }
  
  async function loadPageSections(params = {}) {
    try {
      let url = params.url;
      if (!url) {
        throw new Error("地址不能为空");
      }
      if (params["sort_by"]) {
        url += `&sort_by=${params.sort_by}`;
      }
      if (params["from"]) {
        url += `&from=${params.from}`;
      }
      // 1. 获取HTML内容
      console.log("=== 获取HTML内容 ===");
      const response = await Widget.http.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        },
      });
  
      if (!response || !response.data || typeof response.data !== "string") {
        throw new Error("无法获取有效的HTML内容");
      }
  
      const htmlContent = response.data;
      console.log(`获取到HTML内容长度: ${htmlContent.length} 字符`);
      console.log(htmlContent);
  
      return parseHtml(htmlContent);
    } catch (error) {
      console.error("测试过程出错:", error.message);
      throw error;
    }
  }
  
  async function parseHtml(htmlContent) {
    // 2. 解析HTML
    console.log("\n=== 解析HTML ===");
    const $ = Widget.html.load(htmlContent);
    const sectionSelector = ".site-content .py-3,.pb-e-lg-40";
    const itemSelector = ".video-img-box";
    const coverSelector = "img";
    const durationSelector = ".absolute-bottom-right .label";
    const titleSelector = ".title a";
  
    let sections = [];
    //use cheerio to parse html
    const sectionElements = $(sectionSelector).toArray();
    for (const sectionElement of sectionElements) {
      const $sectionElement = $(sectionElement);
      var items = [];
      const sectionTitle = $sectionElement.find(".title-box .h3-md").first();
      const sectionTitleText = sectionTitle.text();
      console.log("sectionTitleText:", sectionTitleText);
      const itemElements = $sectionElement.find(itemSelector).toArray();
      console.log("itemElements:", itemElements);
      if (itemElements && itemElements.length > 0) {
        for (const itemElement of itemElements) {
          const $itemElement = $(itemElement);
          const titleId = $itemElement.find(titleSelector).first();
          console.log("titleId:", titleId.length);
          const url = titleId.attr("href") || "";
          console.log("url:", url);
          if (url && url.includes("jable.tv")) {
            const durationId = $itemElement.find(durationSelector).first();
            const coverId = $itemElement.find(coverSelector).first();
            const cover = coverId.attr("data-src");
            const video = coverId.attr("data-preview");
            const title = titleId.text();
            const duration = durationId.text();
            const item = {
              id: url,
              type: "url",
              title: title,
              durationText: duration,
              backdropPath: cover,
              previewUrl: video,
              link: url
            };
            console.log("item:", item);
            items.push(item);
          }
        }
  
        sections.push({
          id: sectionTitleText,
          type: "web",
          title: sectionTitleText,
          childItems: items,
        });
      }
    }
    console.log("sections:", sections);
    return sections;
  }
  
  async function loadDetail(link) {
    const response = await Widget.http.get(link, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
    //get hls with regex var hlsUrl = 'https://hot-box-gen.mushroomtrack.com/hls/TJHqwWuFPCwYqa4hyv1cCg/1746892414/50000/50377/50377.m3u8';
    const hlsUrl = response.data.match(/var hlsUrl = '(.*?)';/)[1];
    if (!hlsUrl) {
      throw new Error("无法获取有效的HLS URL");
    }
    console.log("hlsUrl:", hlsUrl);
    const item = {
      id: link,
      type: "detail",
      videoUrl: hlsUrl,
      customHeaders: {
        "Referer": link,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    };
    const sections = await parseHtml(response.data);
    const items = sections.flatMap((section) => section.childItems);
    if (items.length > 0) {
      item.childItems = items;
    }
    return item;
  }