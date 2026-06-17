# Chrome DevTools MCP Surface

This is the browser operator's menu of motor skills. Use CDP/DevTools tools for
deterministic control first, and use screenshots or computer-use style visual
navigation only when DOM/snapshot control is insufficient.

## Browser And Page Control

- `list_pages`
- `select_page`
- `new_page`
- `navigate_page`
- `wait_for`
- `resize_page`
- `close_page`

## Reading State

- `take_snapshot`
- `take_screenshot`
- `list_console_messages`
- `get_console_message`
- `list_network_requests`
- `get_network_request`
- page URL/title metadata from the active target

## Acting On UI

- `click`
- `click_at`
- `fill`
- `fill_form`
- `type_text`
- `press_key`
- `upload_file`
- `drag`
- `hover`
- `handle_dialog`

## Debugging

- `evaluate_script`
- console inspection
- network inspection
- `performance_start_trace`
- `performance_stop_trace`
- `performance_analyze_insight`
- `lighthouse_audit`

## Proof Artifacts

The local harness emits proof artifacts outside Chrome DevTools MCP:

- `.devspace/runs/<run-id>/run.json`
- `.devspace/runs/<run-id>/receipt.json`
- `.devspace/runs/<run-id>/receipt.md`
- `.devspace/runs/<run-id>/final.png`
- `.devspace/runs/<run-id>/snapshot.json`
- `.devspace/runs/<run-id>/console.json`
- `.devspace/runs/<run-id>/network.json`

Run with `BROWSER_OBSERVER=1` to print a temporary localhost run-inspector URL.
