FROM php:8.4-cli

# Instala as dependências do sistema e o Node.js (para o React/Inertia)
RUN apt-get update && apt-get install -y \
    git unzip curl libpq-dev \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Instala as extensões do PostgreSQL
RUN docker-php-ext-install pdo pdo_pgsql

# Instala o Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Define a pasta de trabalho
WORKDIR /app
COPY . .

# Instala os pacotes do PHP e do React
RUN composer install --no-dev --optimize-autoloader
RUN npm install && npm run build

# O Render vai usar a porta 10000 por padrão
ENV PORT=10000

# Inicia o servidor do Laravel
CMD php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=$PORT