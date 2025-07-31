@echo off
echo 🚀 Starting deployment process...

echo 📦 Building application...
npm run build

if %errorlevel% equ 0 (
    echo ✅ Build successful!
    echo 📁 Build files are in: dist/lonex_investments/
    echo.
    echo 🎯 Next steps:
    echo 1. Go to https://netlify.com
    echo 2. Sign up/Login with GitHub
    echo 3. Drag and drop the 'dist/lonex_investments' folder to Netlify
    echo 4. Your site will be live instantly!
    echo.
    echo 🔧 Don't forget to set environment variables in Netlify:
    echo    - SUPABASE_URL=https://wmmcvfabkgyvunupmxes.supabase.co
    echo    - SUPABASE_ANON_KEY=your_supabase_anon_key
) else (
    echo ❌ Build failed! Please check the errors above.
    pause
    exit /b 1
)

pause 