@echo off
echo Starting backend tests...
cd /d "d:\projects\promptmaster-pro (3)\promptmaster-pro (2)\promptmaster-pro\Bbackend"
echo.
echo === 1. Create test progress ===
node create-test-progress.js
echo.
echo === 2. Verify test progress ===
node test-get-progress.js
echo.
echo Tests complete! Check Dashboard for certs.
pause

