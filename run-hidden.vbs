' Lanza el servidor de Agenda Financiera sin ventana de consola.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
sh.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
' El 0 oculta la ventana; False = no esperar a que termine.
sh.Run "node --no-warnings server/index.js", 0, False
