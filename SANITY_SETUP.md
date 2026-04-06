# Sanity.io Wedding Registry Setup

## ✅ Setup Complete!

Your wedding registry is now powered by Sanity.io with real-time updates!

### 🔑 Project Credentials

- **Project ID:** `al7hyz6y`
- **Project Name:** Semilore-Adelouwa's wedding
- **Dataset:** `production`
- **API Token:** Stored in `.env` file (keep this secure!)

### 📁 What Was Created

#### Frontend (`/src`)
- `src/js/sanity.js` - Sanity client and helper functions
- `.env` - Environment variables (DO NOT commit to git!)

#### Studio (`/studio`)
- `studio/sanity.config.js` - Studio configuration
- `studio/schemas/registryItem.js` - Registry item schema
- `studio/schemas/claim.js` - Gift claim schema
- `studio/migrations/seedRegistry.js` - Data seeding script

### 🚀 Running the Project

#### 1. Start the Wedding Website
```bash
npm run dev
```
Visit: http://localhost:3000

#### 2. Start Sanity Studio (Admin Dashboard)
```bash
npm run studio
```
Visit: http://localhost:3333

The couple can use the Studio to:
- View all registry items
- See who claimed what
- Track contributions and amounts
- Update claim statuses (pending → confirmed → received)
- Add notes to claims

### 🌐 Deploy Sanity Studio Online

To give the couple access to the admin dashboard from anywhere:

```bash
npm run studio:deploy
```

This will deploy the Studio to: `https://semilore-adelouwa-s-wedding.sanity.studio`

### 📊 Registry Data

**19 items seeded:**
- 16 "Claim" items (one person takes the whole gift)
- 3 "Fund" items (crowdfunding with goals):
  - Chest Freezer: ₦500,000
  - House Paint: ₦600,000
  - Inverter & Battery System: ₦2,000,000

### ✨ Features Implemented

✅ **Real-time Updates**
- When someone claims a gift, all browsers see the update instantly
- No page refresh needed

✅ **Email Collection**
- Optional email field for guests
- Helps couple send thank-you notes

✅ **Smart Contributions**
- Automatically caps contributions at remaining amount
- Shows real-time progress bars
- Lists all contributors

✅ **Admin Dashboard**
- Beautiful Sanity Studio interface
- Track all claims and contributions
- Update statuses and add notes

### 🔔 Email Notifications (Optional - Next Step)

To get email alerts when gifts are claimed, we can set up a webhook:

1. Go to https://www.sanity.io/manage/project/al7hyz6y
2. Click "API" → "Webhooks"
3. Add webhook URL (we can use services like Zapier or Make.com)
4. Configure to trigger on "claim" document creation

### 🛠️ Troubleshooting

**Registry not loading?**
- Check browser console for errors
- Verify `.env` file exists with correct credentials
- Make sure dev server is running

**Claims not saving?**
- Check API token has "Editor" permissions
- Verify network tab shows successful POST requests
- Check Sanity Studio to see if data appears there

**Real-time updates not working?**
- Real-time requires `useCdn: false` in client config (already set)
- Check browser console for subscription errors

### 📝 Important Notes

1. **Never commit `.env` to git** - It contains your API token
2. **API Token Security** - The token has Editor permissions, keep it safe
3. **Free Tier Limits** - 100K API requests/month (plenty for a wedding!)
4. **Dataset** - Using "production" dataset

### 🎨 Customization

To modify registry items:
1. Open Sanity Studio (http://localhost:3333)
2. Click "Registry Item"
3. Add, edit, or delete items
4. Changes appear instantly on the website

To modify claim statuses:
1. Open Sanity Studio
2. Click "Gift Claim"
3. Update status: Pending → Confirmed → Received
4. Add notes for internal tracking

### 📞 Support

- Sanity Docs: https://www.sanity.io/docs
- Sanity Community: https://slack.sanity.io
- Project Dashboard: https://www.sanity.io/manage/project/al7hyz6y

---

**Congratulations! Your registry is live! 🎉**
