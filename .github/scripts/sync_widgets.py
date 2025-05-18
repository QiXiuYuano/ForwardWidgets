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

detailed_updates = []

for local_widget in local['widgets']:
    remote_widget = None
    # Find the corresponding original widget in the deep copy
    original_widget = next((w for w in original_local['widgets'] if w.get("id") == local_widget.get("id") and w.get("author") == local_widget.get("author")), None)

    for widgets_list in all_remote_widgets_lists:
        # Simultaneously match id and author
        match = next((w for w in widgets_list if w.get("id") == local_widget.get("id") and w.get("author") == local_widget.get("author")), None)
        if match:
            remote_widget = match
            break

    if remote_widget and original_widget: # Ensure both remote and original exist
        current_widget_updates = []
        for field in fields_to_update:
            # Check if field exists in remote data and is different from original local data
            original_value = original_widget.get(field)
            remote_value = remote_widget.get(field)

            if field in remote_widget and original_value != remote_value:
                # Update the local widget with the new value
                local_widget[field] = remote_value
                # Record the detailed change
                current_widget_updates.append(f"  - {field}: {original_value} -> {remote_value}")

        # If there were updates for this widget, format and add to detailed_updates
        if current_widget_updates:
            widget_header = f"{local_widget.get('author')} 的 {local_widget.get('id')} widgets 存在更新："
            detailed_updates.append(widget_header + "\\n" + "\\n".join(current_widget_updates))


# Compare updated local data with original local data
if local != original_local:
    with open(LOCAL_FWD, 'w', encoding='utf-8') as f:
        json.dump(local, f, ensure_ascii=False, indent=2)

    # Write status and detailed update information to GITHUB_OUTPUT
    with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
        f.write('status=updated\n')
        if detailed_updates:
            # Convert detailed updates list to string, with \\n\\n separator between each widget's updates
            detailed_updates_str = "\\n\\n".join(detailed_updates)
            # Special handling for multiline strings in GITHUB_OUTPUT - output as single line escaped string
            f.write(f'updated_widgets={detailed_updates_str}\n')
        else:
             # This case should ideally not happen if local != original_local
             f.write('updated_widgets=None\n')

else:
    with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
        f.write('status=no_updates\n')
        f.write('updated_widgets=None\n') # No updates, set update info to None
