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

# Porta do Render. IMPORTANTE: DATABASE_URL NÃO é definida aqui de propósito —
# o Render já injeta essa variável automaticamente em qualquer serviço com um
# Postgres vinculado, e antes havia uma senha de banco de produção fixa neste
# arquivo (exposta pra sempre no histórico do Git). Se por algum motivo o
# Render não estiver injetando DATABASE_URL sozinho, configure-a manualmente
# como variável de ambiente secreta no painel do serviço — nunca aqui no código.
ENV PORT=10000

# Limpa o cache, roda as migrations, sobe um worker da fila (e-mails de
# confirmação de pagamento, fila, etc. — sem isso eles ficam parados pra
# sempre na tabela `jobs`, nunca saindo) e inicia o servidor do Laravel.
# O worker roda em loop (reinicia sozinho se cair) e em segundo plano.
# IMPORTANTE: o " > /tmp/queue-worker.log 2>&1" no processo em segundo plano
# não é opcional — sem redirecionar a saída dele pra outro lugar, ele herda a
# mesma stdout do container e a aplicação FICA TRAVADA para sempre esperando
# esse processo (que nunca termina) antes de sequer chegar no "php artisan
# serve" — foi exatamente isso que deixou o app "rodando" no Render mas sem
# responder nada (tela em branco): o servidor nunca chegava a subir.
CMD sh -c "php artisan config:clear && php artisan migrate --force && (while true; do php artisan queue:work --tries=3 --max-time=3600 --sleep=3; done > /tmp/queue-worker.log 2>&1 &) && php artisan serve --host=0.0.0.0 --port=$PORT"