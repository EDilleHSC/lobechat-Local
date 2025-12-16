@echo off
set FILE_PATH=%1

if "%FILE_PATH%"=="" (
  echo No file path provided.
  exit /b 1
)

explorer /select,"%FILE_PATH%"