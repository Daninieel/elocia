@echo off
title ELOCIA Student Desktop - Executable Builder
color 0A

echo =========================================================
echo    ELOCIA STUDENT DESKTOP STANDALONE EXECUTABLE BUILDER  
echo =========================================================
echo.

set "ROOT_DIR=%~dp0"
if exist "%ROOT_DIR%elocia\apps\student-desktop" (
    set "FRONTEND_DIR=%ROOT_DIR%elocia\apps\student-desktop\frontend"
    set "DESKTOP_DIR=%ROOT_DIR%elocia\apps\student-desktop\desktop"
) else if exist "%ROOT_DIR%apps\student-desktop" (
    set "FRONTEND_DIR=%ROOT_DIR%apps\student-desktop\frontend"
    set "DESKTOP_DIR=%ROOT_DIR%apps\student-desktop\desktop"
) else (
    set "FRONTEND_DIR=%ROOT_DIR%..\apps\student-desktop\frontend"
    set "DESKTOP_DIR=%ROOT_DIR%..\apps\student-desktop\desktop"
)

:: 1. Resolve Python
set "PYTHON_EXE="
if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
) else (
    where python >nul 2>nul
    if %errorlevel% equ 0 (
        set "PYTHON_EXE=python"
    ) else (
        echo [ERROR] Python 3.11 not found!
        pause
        exit /b 1
    )
)

echo [INFO] Python:   %PYTHON_EXE%
echo [INFO] Frontend: %FRONTEND_DIR%
echo [INFO] Desktop:  %DESKTOP_DIR%
echo.

:: 2. Build React Frontend (Vite)
echo [1/4] Compiling React Frontend to Production Assets...
cd /d "%FRONTEND_DIR%"
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b 1
)
echo       [OK] Frontend built successfully.
echo.

:: 3. Stage Assets in Desktop Directory
echo [2/4] Staging Frontend UI Assets (excluding heavy videos/thumbnails)...
cd /d "%DESKTOP_DIR%"
if exist "frontend_dist" rmdir /s /q "frontend_dist"
xcopy /E /I /Y "%FRONTEND_DIR%\dist" "frontend_dist\" >nul

:: Strip heavy videos and thumbnails so they stream from cloud/backend without bloating the .exe
if exist "frontend_dist\videos" rmdir /s /q "frontend_dist\videos"
if exist "frontend_dist\thumbnails" rmdir /s /q "frontend_dist\thumbnails"
echo       [OK] Staged lightweight frontend_dist (~25 MB).
echo.

:: 4. Run PyInstaller
echo [3/4] Building Standalone Windows Executable with PyInstaller...
"%PYTHON_EXE%" -m PyInstaller --clean --noconfirm ELOCIA_Student.spec
if %errorlevel% neq 0 (
    echo [ERROR] PyInstaller build failed!
    pause
    exit /b 1
)
echo       [OK] Executable generated.
echo.

:: 5. Copy server_config.json and create ZIP archive
echo [4/4] Finalizing Distribution Package...
if exist "server_config.json" (
    copy /Y "server_config.json" "dist\ELOCIA_Student\server_config.json" >nul
)

echo       Creating ZIP archive: dist\ELOCIA_Student_Desktop.zip ...
powershell -Command "Compress-Archive -Path 'dist\ELOCIA_Student' -DestinationPath 'dist\ELOCIA_Student_Desktop.zip' -Force" >nul 2>&1

echo.
echo =========================================================
echo       BUILD COMPLETED SUCCESSFULLY!                      
echo =========================================================
echo.
echo Standalone App Directory:
echo   %DESKTOP_DIR%\dist\ELOCIA_Student\ELOCIA_Student.exe
echo.
echo Portable ZIP (for sharing to student laptops):
echo   %DESKTOP_DIR%\dist\ELOCIA_Student_Desktop.zip
echo.
echo To launch the app now, run:
echo   "%DESKTOP_DIR%\dist\ELOCIA_Student\ELOCIA_Student.exe"
echo.
pause

