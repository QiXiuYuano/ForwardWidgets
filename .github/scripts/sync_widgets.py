import json
import requests
import copy
import os

LOCAL_FWD = 'ForwardWidgets.fwd'
SOURCES = [
    ('huangxd', 'https://raw.githubusercontent.com/huangxd-/ForwardWidgets/refs/heads/main/widgets.fwd'),
    ('pack1r', 'https://raw.githubusercontent.com/pack1r/ForwardWidgets/refs/heads/main/pack1r.fwd'),
    ('两块', 'https://raw.githubusercontent.com/2kuai/ForwardWidgets/refs/heads/main/forward-widgets.fwd'),
    ('阿米诺斯', 'https://raw.githubusercontent.com/quantumultxx/FW-Widgets/refs/heads/main/ForwardWidgets.fwd'),
]

with open(LOCAL_FWD, encoding='utf-8') as f:
    local = json.load(f)

original_local = copy.deepcopy(local)

fields_to_update = ["version", "requiredVersion", "url", "author"]

all_remote_widgets_lists = []
for author, url in SOURCES:
    try:
        resp = requests.get(url, timeout=10)
        data = json.loads(resp.text)
        widgets_list = data.get('widgets') or data.get('Widgets')
        if widgets_list:
            all_remote_widgets_lists.append(widgets_list)
    except Exception as e:
        print(f'Failed to fetch {author}: {e}')

updated_widgets_info = [] 

for local_widget in local['widgets']:
    remote_widget = None
    for widgets_list in all_remote_widgets_lists:
        match = next((w for w in widgets_list if w.get("id") == local_widget.get("id") and w.get("author") == local_widget.get("author")), None)
        if match:
            remote_widget = match
            break
    if remote_widget:
        widget_updated = False 
        for field in fields_to_update:
            if field in remote_widget and local_widget.get(field) != remote_widget.get(field):
                local_widget[field] = remote_widget[field]
                widget_updated = True
        if widget_updated:
             updated_widgets_info.append(f"- ID: {local_widget.get('id')}, Author: {local_widget.get('author')}")


if local != original_local:
    with open(LOCAL_FWD, 'w', encoding='utf-8') as f:
        json.dump(local, f, ensure_ascii=False, indent=2)

    with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
        f.write('status=updated\n')
        if updated_widgets_info:
            # 将更新信息列表转换为字符串，换行符用 \n 转义
            updated_info_str = "\\n".join(updated_widgets_info)
            f.write(f'updated_widgets={updated_info_str}\n')
        else:
             f.write('updated_widgets=None\n')

else:
    with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
        f.write('status=no_updates\n')
        f.write('updated_widgets=None\n')