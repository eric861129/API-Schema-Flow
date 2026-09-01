# Reservation canonical fixture

This directory contains the synthetic, offline OpenAPI document used for the first API Schema Flow vertical slice.

It intentionally covers four operations:

- `POST /auth/login`
- `GET /spaces/available`
- `POST /reservations`
- `GET /reservations/{id}`

All example identities, tokens, hosts, and resource values are synthetic. The fixture must remain safe to publish and runnable without network access.
