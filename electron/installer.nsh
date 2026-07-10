!include "nsDialogs.nsh"
!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER

Var DesktopShortcutCheckbox
Var DesktopShortcutRequested

!macro customInit
  StrCpy $DesktopShortcutRequested "1"
!macroend

!macro customPageAfterChangeDir
  Page custom DesktopShortcutPageCreate DesktopShortcutPageLeave
!macroend

Function DesktopShortcutPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 28u "เลือกทางลัดที่ต้องการสร้างสำหรับ YATA"
  Pop $0

  ${NSD_CreateCheckbox} 0 38u 100% 14u "สร้างทางลัด YATA บน Desktop"
  Pop $DesktopShortcutCheckbox

  ${If} $DesktopShortcutRequested == "1"
    ${NSD_Check} $DesktopShortcutCheckbox
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function DesktopShortcutPageLeave
  ${NSD_GetState} $DesktopShortcutCheckbox $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $DesktopShortcutRequested "1"
  ${Else}
    StrCpy $DesktopShortcutRequested "0"
  ${EndIf}
FunctionEnd

!macro customInstall
  ${If} $DesktopShortcutRequested != "1"
    Delete "$newDesktopLink"
  ${EndIf}
!macroend

!endif
