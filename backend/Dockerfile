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

# Configura a porta do Render e a URL interna do Banco de Dados
ENV PORT=10000
ENV DATABASE_URL="postgresql://lokyva_byn2_user:Z2rHOXgwq2wXrVy80F4pUABmDY2fvf1Y@dpg-dao089740ujc73de4aag-a/lokyva_byn2?sslmode=require"

# Limpa o cache, roda as migrations e inicia o servidor do Laravel
CMD sh -c "php artisan config:clear && php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=$PORT"