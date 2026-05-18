---
name: weweb-sidebars
description: Sidebar layouts — fixed left/right panels with scrollable main content, including collapsible variants. Load when the user asks for a dashboard, side navigation, settings panel, or any persistent off-canvas layout.
metadata:
  type: weweb
---

# Sidebar skill

## Layout

To create a sidebar you should usually use the `ww-section` element:

### The sidebar

- Define a `ww-section` sidebar that is fixed on the left of the page.
- Always use `position: fixed` and `left: 0px` for the style and set a `<sidebar width>` width in px.

### Content

- Define as many other `ww-section`s that will constitute the content of the page.
- Always use `marginLeft: <sidebar width>px` for the style of every other section to ensure it is aligned with the sidebar.

The content of the page will be scrollable and the sidebar will stay in place.

## Collapsible sidebar

To have a collapsible sidebar you should also create a boolean global variable that will store the collapse state of the sidebar and add a trigger in the page (usually in the sidebar) to toggle the variable using a workflow (button, icon, text, …). The width of the sidebar and the margins of the other sections should be dynamic depending on the value of the variable. Use a transition on both the sidebar and the other sections to ensure a smooth transition between states.

## Note

It is also possible to create everything inside a single `ww-section`. In this case the sidebar and the content containers must be `ww-div`. Prefer using the sidebar as `ww-section` method when creating or editing a page.
