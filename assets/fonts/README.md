# Passport cover lettering

`passport-calligraphy.ttf` is the four-character (美食护照) subset of Ma Shan Zheng supplied by Google Fonts, fetched 2026-11-04 with the text parameter. The original family is by the Ma Shan Zheng Project Authors: https://github.com/googlefonts/mashanzheng .

Source API: https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&text=%E7%BE%8E%E9%A3%9F%E6%8A%A4%E7%85%A7&display=swap

License: SIL Open Font License 1.1, included in OFL-Ma-Shan-Zheng.txt. The title cut is self-hosted and cached for offline use; no Google Fonts request is made by the site. The CSS family alias is Passport Calligraphy. The cover title retains this separate calligraphic face.

## Editorial headings

`passport-editorial.woff2` is a renamed character subset of the variable Noto Serif SC font (weight axis 200–900), downloaded 2026-11-05 from Google Fonts. It covers the current interface and restaurant/destination characters; unsupported future characters fall back to the system serif stack. Headings and restaurant names use it; body text and controls keep the system sans-serif stack. It is self-hosted, preloaded and included in the offline shell.

Source: https://github.com/google/fonts/tree/main/ofl/notoserifsc

Upstream font SHA-256: `050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9`. License: SIL OFL 1.1, included in `OFL-Noto-Serif-SC.txt`. The modified family name is Passport Editorial.

Rebuild with fontTools and Brotli installed: `python tools/subset_editorial_font.py path/to/NotoSerifSC-variable.ttf`. Run from the repository root after updating interface or restaurant text to include new characters.
