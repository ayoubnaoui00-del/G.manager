# G.manager backend rules
- Node.js + Express + PostgreSQL (`pg`). ES Modules ONLY (import/export). Never use require/module.exports.
- Always add `.js` to relative imports, e.g. `import { query } from '../config/db.js'`.
- Use existing helpers: `query(sql, params)` from config/db.js, `ApiError(statusCode, message)` from utils/ApiError.js, `asyncHandler(fn)` from utils/asyncHandler.js.
- Controllers go in src/controllers/*.controller.js, routes in src/routes/*.routes.js, mounted in src/routes/index.js.
- Responses: `{ success: true, data }`. Errors: throw ApiError.
- ALWAYS use parameterized SQL ($1, $2). Never concatenate user input into SQL.
- Single-owner app: there is NO gym_id column. Do not filter by gym.
- Money is in MAD. `NUMERIC` columns come back from pg as strings: convert with Number() and compare in cents.
- Status is NEVER read from a stored column. Compute it from subscriptions.end_date (end_date >= CURRENT_DATE = active; the last day is included).
- Subscription price comes from plans.price (JOIN subscriptions.plan_id). subscriptions has no price column.
- Total paid for a subscription must never exceed the plan price.

## Schema (summary)
members(id, full_name, phone, email, status, join_date, notes, created_at)
plans(id, name, duration_days, price, description, is_active, created_at)
subscriptions(id, member_id, plan_id, start_date, end_date, status, created_at)
payments(id, subscription_id NULL, member_id, amount > 0, payment_date DATE, payment_method IN ('cash','card','transfer'), notes, created_at)