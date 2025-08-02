# no sign app

- download zip build. extract, move file to applications
- use script editor (utility folder) in mac os, create a single line script with this code:
  `do shell script "xattr -dr com.apple.quarantine '/Applications/CenterBots.app' && codesign --force --deep --sign - '/Applications/CenterBots.app'" with administrator privileges
`
- give it a name, save as "application" (not script) in applications folder
- run and type mac user password
