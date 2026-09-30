<?php

/**
 * Categorias de SERVIÇO (fonte única). O proprietário escolhe uma ao criar/editar o serviço; o
 * Explorar do cliente usa a mesma lista para os chips de filtro. `valor` é exatamente o texto
 * gravado em `servicos.tipo_servico` — igual ao que a tela já usava, só ampliado e sem duplicidade.
 *
 * `icone` é um nome do MaterialIcons; `cor` é o tom da categoria, escolhido pela emoção que ela passa
 * (beleza = rosa, saúde = azul de confiança, festas = roxo, automotivo = índigo...) — para os chips do
 * app não ficarem todos na cor de destaque (laranja) da marca.
 */
return [
    'servicos' => [
        ['valor' => 'Beleza e Estética',        'icone' => 'content-cut',       'cor' => '#E8467C'],
        ['valor' => 'Barbearia',                 'icone' => 'storefront',        'cor' => '#1F6F8B'],
        ['valor' => 'Moda e Estilo',              'icone' => 'brush',             'cor' => '#C026D3'],
        ['valor' => 'Saúde e Bem-Estar',          'icone' => 'local-hospital',    'cor' => '#2563EB'],
        ['valor' => 'Fitness e Esportes',         'icone' => 'fitness-center',    'cor' => '#DC2626'],
        ['valor' => 'Pets e Animais',             'icone' => 'pets',              'cor' => '#D97706'],
        ['valor' => 'Automotivo',                 'icone' => 'directions-car',    'cor' => '#4F46E5'],
        ['valor' => 'Casa e Construção',          'icone' => 'handyman',          'cor' => '#B45309'],
        ['valor' => 'Limpeza e Manutenção',       'icone' => 'cleaning-services', 'cor' => '#0EA5A4'],
        ['valor' => 'Casamentos e Festas',        'icone' => 'celebration',       'cor' => '#7C3AED'],
        ['valor' => 'Eventos e Entretenimento',   'icone' => 'event',             'cor' => '#9333EA'],
        ['valor' => 'Fotografia e Vídeo',         'icone' => 'photo-camera',      'cor' => '#0F766E'],
        ['valor' => 'Tecnologia',                 'icone' => 'computer',          'cor' => '#0369A1'],
        ['valor' => 'Educação e Cursos',          'icone' => 'school',            'cor' => '#1D4ED8'],
        ['valor' => 'Turismo e Viagens',          'icone' => 'beach-access',      'cor' => '#0284C7'],
        ['valor' => 'Serviços Profissionais',     'icone' => 'business-center',   'cor' => '#475569'],
        ['valor' => 'Outros',                     'icone' => 'more-horiz',        'cor' => '#6A6C72'],
    ],
];
