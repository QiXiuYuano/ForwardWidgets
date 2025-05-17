import json
import requests

LOCAL_FWD = 'ForwardWidgets.fwd'
SOURCES = [
    ('huangxd', 'https://raw.githubusercontent.com/huangxd-/ForwardWidgets/refs/heads/main/widgets.fwd'),
    ('pack1r', 'https://raw.githubusercontent.com/pack1r/ForwardWidgets/refs/heads/main/pack1r.fwd'),
    ('两块', 'https://raw.githubusercontent.com/2kuai/ForwardWidgets/refs/heads/main/forward-widgets.fwd'),
    ('阿米诺斯', 'https://raw.githubusercontent.com/quantumultxx/FW-Widgets/refs/heads/main/ForwardWidgets.fwd'),
]

with open(LOCAL_FWD, encoding='utf-8') as f:
    local = json.load(f)

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


for local_widget in local['widgets']:
    remote_widget = None
    for widgets_list in all_remote_widgets_lists:
        match = next((w for w in widgets_list if w.get("id") == local_widget.get("id") and w.get("author") == local_widget.get("author")), None)
        if match:
            remote_widget = match
            break
    if remote_widget:
        for field in fields_to_update:
            if field in remote_widget:
                local_widget[field] = remote_widget[field]

with open(LOCAL_FWD, 'w', encoding='utf-8') as f:
    json.dump(local, f, ensure_ascii=False, indent=2)