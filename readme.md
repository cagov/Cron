## Development

To develop in VSCode install <a href="https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=macos%2Ccsharp%2Cbash#v2">azure functions core tools</a>

This will allow you to run commands like ```func new``` which will take you through a command line wizard to scaffold a new function.

### Debugging

A good way to execute a single function locally is to launch it from the debugger in VSCode

The functions available to launch this way are setup in the ```.vscode/launch.json``` file. When dealing with timer trigger functions you can point directly at the function index.js file so it won't try to help debug your cron expression but will run the function itself.

You can insert breakpoints and run specific functions locally this way.

If you aren't using the debugger and are starting the entire project locally you are running the risk of some timer trigger function executing based on your local system clock. This project contains many functions. If it is started locally outside of debug mode all of them will activate and begin listening for triggers.