---
name: API - New Route
about: Issue to describe the desire new route
title: API - [NameHere]
labels: API, Test
assignees: ''

---

### [NameHere]
`GET '/social/.../[name-here]'`
Params :
- `key : value`

Response :
- `key: value`

### Errors
#### `UNAUTHORIZED: 'You must be logged in'`
#### ...

### Tests
```typescript
describe("API - [NameHere]", () => {
   it("should raise an error if...", async () => {});

   ...
});
```
