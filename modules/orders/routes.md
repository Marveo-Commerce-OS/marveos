# Orders Module Routes

Legacy routes retained:
- UI: /dashboard/orders
- API: /api/orders

New architecture routes:
- UI: /os/orders
- API: /api/os/orders

Migration note:
- New routes wrap existing behavior through shared module service to avoid logic duplication.
