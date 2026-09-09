# Khan Sofa API

Express and Prisma API for the Khan Sofa furniture store.

## Database setup

1. Copy `.env.example` to `.env` and update the PostgreSQL credentials.
2. Run `npm install`.
3. Run `npm run db:setup`.

`db:setup` creates the dedicated `khan_sofa` database when it does not exist,
applies the furniture schema, and seeds categories, products, navigation, reviews,
an admin account, and the welcome coupon.

The database role needs `CREATEDB` for the first step. If the database is managed
for you, create it in the provider dashboard and run `npm run db:push && npm run db:seed`.

## Development

```bash
npm run dev
```

The API defaults to `http://127.0.0.1:4000/api`.
# khanSofaBackend
