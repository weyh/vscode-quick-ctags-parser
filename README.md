# Quick ctags parser

I wrote this small extension because all the other already available ones didn't work for me. It's a life saver for big projects where clangd or the built in parser cannot parse the code base within a work day 🙂

## Usage

1. **Generate tags via ctags** (I use this command: `ctags --fields=+n --languages=C,C++ --exclude=@.gitignore -R -f .tags .`)
2. Select a tag that you want to look up
3. Use `crtl+t` or *right click + Jump to definition*


## License

This extension is licensed under the [MIT License](LICENSE).
