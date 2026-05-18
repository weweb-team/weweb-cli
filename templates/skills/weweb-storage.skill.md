---
name: weweb-storage
description: File uploads with `ww-input-file`, public-file table-view columns, displaying uploaded images. Load whenever the user wants to upload, display, or manage files/images.
metadata:
  type: weweb
---

# Storage skill

## The file upload element

**Always use `ww-input-file` for file uploads.**

**Never use `ww-input-basic` with `type: "file"`** — this is a standard HTML input that does not integrate with WeWeb's storage system. The only correct element for file uploads is `ww-input-file`.

**Key properties of `ww-input-file`:**
- `type`: `"single"` for one file, `"multi"` for multiple files
- `extensions`: filter by file type — `"image"`, `"video"`, `"audio"`, `"pdf"`, `"any"`, etc.
- `maxFileSize`: maximum file size in MB

## Binding a file parameter in a backend workflow call

When calling a backend workflow endpoint that has a `file` type parameter, the binding syntax is **different** from regular parameters.

Use `"{elementUid}-value"` as a **plain string** — NOT a formula object:

```json
{
  "parameters": {
    "image": "a1b2c3d4-value",
    "caption": { "__wwtype": "f", "code": "variables['...']" }
  }
}
```

Where `a1b2c3d4` is the UID of the `ww-input-file` element. The `-value` suffix refers to its internal `value` variable.

**Rules:**
- File parameters → `"{elementUid}-value"` plain string
- All other parameters → formula object `{"__wwtype":"f","code":"..."}`

## Upload workflow pattern

1. Add a `ww-input-file` on the page
2. Add a `ww-button` to trigger the upload
3. On button click: `execute-backend-workflow:<uploadEndpointUid>` with the file parameter bound to `"{ww-input-file-uid}-value"`
4. On success: re-fetch the table view to display the newly uploaded file

## Displaying uploaded files (public)

When a table view has a column joined to `publicFiles` (storage schema), the joined object exposes a `url` field — the CDN URL of the file.

Bind a `ww-image` `src` property to the `url` of the joined alias. Always use optional chaining (`?.url`) because the column can be `null` if no file was uploaded. Provide a fallback placeholder with `??`:

```
<alias>?.url ?? '<placeholder-image-url>'
```

When displaying a list of items from a table view, bind the repeating container's source to `globalContext.tableViews['<UUID>']?.data`. Inside each repeated item, access `<alias>?.url` directly.

## What to do and not to do

- **Do** use `ww-input-file` — the only valid file upload element
- **Do** bind file parameters as `"{elementUid}-value"` plain string in workflow calls
- **Do** use `?.url` when binding a public file URL — the column can be null
- **Do** provide a fallback image for null storage columns (`?? 'placeholder-url'`)
- **Do** re-fetch the table view after a successful upload to reflect the change
- **Do not** use `ww-input-basic` with type "file" — it does not integrate with storage
- **Do not** bind file parameters with a formula object — use the `{elementUid}-value` string
- **Do not** expose `exposeBase64` or `exposeBinary` for backend upload workflows
