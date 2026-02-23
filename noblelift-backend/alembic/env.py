from __future__ import annotations
from logging.config import fileConfig
import sys
from sqlalchemy.engine.url import make_url
from sqlalchemy import engine_from_config, pool
from alembic import context
from app.core.config import settings

config = context.config

# --- DIAGNOSTICS + SANITIZE URL ---
raw_url = settings.DATABASE_URL
print("Alembic DATABASE_URL (repr):", repr(raw_url), file=sys.stderr)

if not isinstance(raw_url, str):
    raise TypeError(f"DATABASE_URL must be str, got {type(raw_url)}")

try:
    raw_url = raw_url.strip()
    raw_url.encode("utf-8")  # ensure encodable
except Exception as e:
    raise RuntimeError(f"DATABASE_URL is not valid UTF-8: {e}. Value: {repr(raw_url)}")

try:
    parsed = make_url(raw_url)
except Exception as e:
    raise RuntimeError(f"Invalid DATABASE_URL format: {repr(raw_url)}\n{e}")

config.set_main_option("sqlalchemy.url", str(parsed))
# --- /DIAGNOSTICS ---

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = None

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
