@ECHO OFF
SET PROCIMAGE=run.exe
SET HOST=--host 0.0.0.0
SET PORT=--port 10101
TASKLIST /FI "IMAGENAME eq %PROCIMAGE%" | FIND "%PROCIMAGE%" > NUL
if NOT %errorlevel% == 0 (
    PUSHD "C:\Program Files\AivisSpeech\AivisSpeech-Engine"
    START "AivisSpeech Engine" %PROCIMAGE% %HOST% %PORT% --load_all_models
    POPD
)
