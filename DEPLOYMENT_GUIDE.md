# 🚀 Lonex Investments - Deployment Guide

## 📋 Prerequisites

Before deploying, ensure you have:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Git](https://git-scm.com/) installed
- A Supabase project set up with proper environment variables

## 🎯 Hosting Options

### **Option 1: Netlify (Recommended - Free)**

#### **Step 1: Prepare Your Repository**
```bash
# Build your application
npm run build

# The build files will be in: dist/lonex_investments/
```

#### **Step 2: Deploy to Netlify**

**Method A: Drag & Drop (Quick)**
1. Go to [netlify.com](https://netlify.com)
2. Sign up/Login with GitHub
3. Drag and drop the `dist/lonex_investments` folder to Netlify
4. Your site will be live instantly!

**Method B: Git Integration (Recommended)**
1. Push your code to GitHub
2. Connect your GitHub repo to Netlify
3. Netlify will automatically build and deploy on every push

#### **Step 3: Environment Variables**
In Netlify dashboard, go to Site Settings > Environment Variables and add:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### **Option 2: Vercel (Alternative - Free)**

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Vercel will automatically detect Angular and deploy
4. Add environment variables in Vercel dashboard

### **Option 3: GitHub Pages (Free)**

1. Add to your `angular.json`:
```json
"baseHref": "/your-repo-name/"
```

2. Install gh-pages:
```bash
npm install --save-dev gh-pages
```

3. Add to `package.json`:
```json
"scripts": {
  "deploy": "ng build --base-href=/your-repo-name/ && gh-pages -d dist/lonex_investments"
}
```

4. Deploy:
```bash
npm run deploy
```

## 🔧 Environment Setup

### **Supabase Configuration**
Ensure your `src/environments/environment.ts` has:
```typescript
export const environment = {
  production: false,
  supabaseUrl: 'your_supabase_url',
  supabaseKey: 'your_supabase_anon_key'
};
```

And `src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  supabaseUrl: process.env['SUPABASE_URL'] || 'your_supabase_url',
  supabaseKey: process.env['SUPABASE_ANON_KEY'] || 'your_supabase_anon_key'
};
```

## 🚨 Important Notes

1. **Environment Variables**: Never commit your Supabase keys to Git
2. **CORS**: Ensure your Supabase project allows your domain
3. **Build Size**: Your app is ~920KB, which is acceptable for most hosting platforms
4. **Routing**: Angular uses client-side routing, so all hosting platforms need SPA configuration

## 🔍 Troubleshooting

### **Build Issues**
- Ensure all dependencies are installed: `npm install`
- Clear cache: `npm run build -- --delete-output-path`

### **Routing Issues**
- Ensure your hosting platform supports SPA routing
- Check that all routes redirect to `index.html`

### **Environment Variables**
- Double-check your Supabase URL and keys
- Ensure environment variables are set in your hosting platform

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Verify your Supabase connection
3. Ensure all environment variables are set correctly

## 🎉 Success!

Once deployed, your loan management application will be live and accessible to users worldwide!
