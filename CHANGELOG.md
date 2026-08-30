# Changelog

## [0.4.0](https://github.com/vincedelmas/ploux/compare/v0.3.5...v0.4.0) (2026-08-30)


### Features

* harden LAN API and paginate media browsing ([8a6a6f8](https://github.com/vincedelmas/ploux/commit/8a6a6f812fc69ae40f5f97817b34471ffbac1793))


### Bug Fixes

* harden media scanning and inspection ([a60f76f](https://github.com/vincedelmas/ploux/commit/a60f76f31128bc5fdd0f1db7b9dc260279b51f15))
* make scans resilient and probe media on demand ([2779bf6](https://github.com/vincedelmas/ploux/commit/2779bf62506b83d202926d7d162be04c80997390))
* require JSON API bodies and remove Docker support ([c1adbf4](https://github.com/vincedelmas/ploux/commit/c1adbf43c08c3676aa27c054a8907e2f921e00b4))
* **scanner:** remove stale subtitles on rescan ([da300bf](https://github.com/vincedelmas/ploux/commit/da300bfd432a78c02de50c72f9714eb76afbce19))


### Refactors

* add try catch abstraction for API ([dc27b9e](https://github.com/vincedelmas/ploux/commit/dc27b9eed40d3cefd2b3d5285e3d0aad5af0b5a8))
* consolidate duplicated api and media utilities ([a3dbb2f](https://github.com/vincedelmas/ploux/commit/a3dbb2fa2f51a70339b17a7e44a2c538e50e1526))
* share query options and mutations across clients ([1ed6138](https://github.com/vincedelmas/ploux/commit/1ed6138e3b5687fd76696ad4fe205880def23a72))
* **web:** centralize query mutations ([5ff52c4](https://github.com/vincedelmas/ploux/commit/5ff52c43da60dcde2a824e682fe6ccafd855f086))
* **web:** load route queries with suspense ([9a4bd46](https://github.com/vincedelmas/ploux/commit/9a4bd46b3dbc228dfc92a068454289c2802de274))

## [0.3.5](https://github.com/vincedelmas/ploux/compare/v0.3.4...v0.3.5) (2026-08-29)


### Bug Fixes

* **tv:** improve player remote controls and track labels ([b97f523](https://github.com/vincedelmas/ploux/commit/b97f5238da1a5ea75e93613446e694e22bae70a1))

## [0.3.4](https://github.com/vincedelmas/ploux/compare/v0.3.3...v0.3.4) (2026-08-29)


### Bug Fixes

* **tv:** initialize fullscreen after creating player view ([d2f859b](https://github.com/vincedelmas/ploux/commit/d2f859b8e49ea31c5066a2b2a1b5619b06e5a9e3))

## [0.3.3](https://github.com/vincedelmas/ploux/compare/v0.3.2...v0.3.3) (2026-08-29)


### Bug Fixes

* **tv:** prevent native player crashes on 32-bit devices ([f8b9294](https://github.com/vincedelmas/ploux/commit/f8b929458657cbd3e81c891ec9bc4e5e8e95e882))

## [0.3.2](https://github.com/vincedelmas/ploux/compare/v0.3.1...v0.3.2) (2026-08-29)


### Bug Fixes

* **tv:** restore 32-bit Shield compatibility ([8bb4e98](https://github.com/vincedelmas/ploux/commit/8bb4e984646d9a465ffb77dbfb4a9cfce6d1b611))

## [0.3.1](https://github.com/vincedelmas/ploux/compare/v0.3.0...v0.3.1) (2026-08-29)


### Bug Fixes

* **tv:** configure native player module for app builds ([b41a462](https://github.com/vincedelmas/ploux/commit/b41a462aed551f9064f98f988f4e31099f4db8d9))

## [0.3.0](https://github.com/vincedelmas/ploux/compare/v0.2.2...v0.3.0) (2026-08-29)


### Features

* **tv:** replace LibVLC with native Media3 playback ([61a5d05](https://github.com/vincedelmas/ploux/commit/61a5d0517dc2d95e2b840ef0a46e65d734482f56))
* **web:** add collection actions and playback error feedback ([8148b09](https://github.com/vincedelmas/ploux/commit/8148b09110cd806e34a05c8fcb14ae9a5e13c134))


### Bug Fixes

* **dev:** scope server dependency bundling to production ([58f4ccb](https://github.com/vincedelmas/ploux/commit/58f4ccbfa6a192c8b6cfd0c3c020e0b9cd4632bb))
* **streaming:** handle missing media files safely ([43b4e2d](https://github.com/vincedelmas/ploux/commit/43b4e2d0fcb780e77abb90a73902104c7752b3e1))
* **tv:** restore remote controls and fast AVI playback ([1eb556c](https://github.com/vincedelmas/ploux/commit/1eb556c804993aedb86a2ce8dd63eb24d457dd06))


### Performance

* **tv:** reduce APK size and release build time ([0712a58](https://github.com/vincedelmas/ploux/commit/0712a58abee3c05370ab9ece225040a010c903fd))


### Continuous Integration

* target main branch for releases ([8cfee6d](https://github.com/vincedelmas/ploux/commit/8cfee6db28204afb44919672e555db3677b5e031))

## [0.2.2](https://github.com/vincedelmas/ploux/compare/v0.2.1...v0.2.2) (2026-08-28)


### Bug Fixes

* **tv:** stream APK verification without loading it into memory ([3a58c66](https://github.com/vincedelmas/ploux/commit/3a58c662be0969d0f0d6eb013aff71b8c48fa2c9))


### Refactors

* **server:** replace Nitro with Bun.serve ([203d07c](https://github.com/vincedelmas/ploux/commit/203d07c7add2780264dacd571846884360f3dc72))

## [0.2.1](https://github.com/vincedelmas/ploux/compare/v0.2.0...v0.2.1) (2026-08-28)


### Bug Fixes

* **tv:** bridge legacy in-app updates to v0.2.1 ([e9ad42f](https://github.com/vincedelmas/ploux/commit/e9ad42f4d2920c57e7ca5aee7e56781f2e437016))
* **tv:** replace ExoPlayer with LibVLC for direct playback ([172f215](https://github.com/vincedelmas/ploux/commit/172f21560fc93e4399937524b419727f32e9ecc3))
