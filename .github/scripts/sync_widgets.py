import json
import requests
import copy
import os
import re
from packaging import version as packaging_version  # pip install packaging

LOCAL_FWD = 'ForwardWidgets.fwd'
SOURCES = [
    ('huangxd', 'https://raw.githubusercontent.com/huangxd-/ForwardWidgets/refs/heads/main/widgets.fwd'),
    ('pack1r', 'https://raw.githubusercontent.com/pack1r/ForwardWidgets/refs/heads/main/pack1r.fwd'),
    ('两块', 'https://raw.githubusercontent.com/2kuai/ForwardWidgets/refs/heads/main/forward-widgets.fwd'),
    # ('阿米诺斯', 'https://raw.githubusercontent.com/quantumultxx/FW-Widgets/refs/heads/main/ForwardWidgets.fwd'),
    ('huangxd', 'https://gist.githubusercontent.com/huangxd-/37aaa8cca9b888b2bed278e83d4432d9/raw/OtherWidgets.fwd'),
]

fields_to_update = ["version", "requiredVersion", "url", "author"]

# Step 1: 读取本地数据
with open(LOCAL_FWD, encoding='utf-8') as f:
    local = json.load(f)
original_local = copy.deepcopy(local)

# Step 2: 读取所有远程 widgets
all_remote_widgets = []

def clean_json_trailing_commas(text):
    # 移除数组、对象末尾多余的逗号
    text = re.sub(r',(\s*[\]}])', r'\1', text)
    return text

for author, url in SOURCES:
    try:
        resp = requests.get(url, timeout=10)
        cleaned = clean_json_trailing_commas(resp.text)
        data = json.loads(cleaned)
        widgets_list = data.get('widgets') or data.get('Widgets')
        if widgets_list:
            all_remote_widgets.extend(widgets_list)
    except Exception as e:
        print(f'[!] Failed to fetch or parse from {author}: {e}')

# Step 3: 匹配和更新逻辑
detailed_updates = []

for local_widget in local['widgets']:
    original_widget = next(
        (w for w in original_local['widgets'] if w.get("id") == local_widget.get("id") and w.get("author") == local_widget.get("author")),
        None
    )

    # 找出所有远程候选项（id + author 一致）
    candidates = [
        w for w in all_remote_widgets
        if w.get("id") == local_widget.get("id") and w.get("author") == local_widget.get("author")
    ]

    # 从候选中找出 version 最大的
    def parse_ver(v):
        try:
            return packaging_version.parse(v)
        except:
            return packaging_version.parse("0.0.0")

    remote_widget = max(candidates, key=lambda w: parse_ver(w.get("version", "0.0.0")), default=None)

    # 如果找到有效远程版本，进行字段更新
    if remote_widget and original_widget:
        current_widget_updates = []
        for field in fields_to_update:
            original_value = original_widget.get(field)
            remote_value = remote_widget.get(field)
            if field in remote_widget and original_value != remote_value:
                local_widget[field] = remote_value
                current_widget_updates.append(f"  - {field}: {original_value} -> {remote_value}")

        if current_widget_updates:
            widget_header = f"{local_widget.get('author')} 的 {local_widget.get('id')} widgets 存在更新："
            detailed_updates.append(widget_header + "\n" + "\n".join(current_widget_updates))

# Step 4: 写入文件 & GITHUB_OUTPUT
if local != original_local:
    with open(LOCAL_FWD, 'w', encoding='utf-8') as f:
        json.dump(local, f, ensure_ascii=False, indent=2)

    with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
        f.write('status=updated\n')
        if detailed_updates:
            detailed_updates_str = "\n\n".join(detailed_updates)
            # base64 编码
            encoded = base64.b64encode(detailed_updates_str.encode('utf-8')).decode('utf-8')
            f.write(f'updated_widgets_b64={encoded}\n')
        else:
            f.write('updated_widgets_b64=None\n')
else:
    with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
        f.write('status=no_updates\n')
        f.write('updated_widgets_b64=None\n')
