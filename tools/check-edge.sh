#!/usr/bin/env bash
# Confere o que a borda está de fato devolvendo.
#
# O painel do Cloudflare diz o que foi configurado; isto diz o que chega ao
# navegador, que é a única coisa que conta. Rode depois de cada regra criada.
#
#   bash tools/check-edge.sh
#   bash tools/check-edge.sh nipscern.com      # para checar o apex
#
# Cada linha imprime OK ou FALTA, com o valor observado. Roda duas vezes em cada
# URL de propósito: o cf-cache-status da primeira chamada costuma ser MISS
# porque o objeto ainda não está naquele datacenter, e é o da segunda que diz se
# a regra de cache pegou.
set -u
HOST="${1:-www.nipscern.com}"
PASS=0; FAIL=0

hdr () { curl -sS -o /dev/null -D - -H 'Accept-Encoding: br, gzip' "https://$HOST$1" 2>/dev/null; }
val () { printf '%s' "$1" | grep -i "^$2:" | head -1 | cut -d' ' -f2- | tr -d '\r'; }

check () { # $1 rótulo  $2 esperado(regex)  $3 valor
  if printf '%s' "$3" | grep -qiE "$2"; then
    printf '  \033[32mOK  \033[0m %-38s %s\n' "$1" "$3"; PASS=$((PASS+1))
  else
    printf '  \033[31mFALTA\033[0m %-37s %s\n' "$1" "${3:-<ausente>}"; FAIL=$((FAIL+1))
  fi
}

echo "== $HOST =="
echo
echo "-- 1. Cache Rule: assets imutáveis (/assets/*)"
A=$(hdr /assets/css/main.min.css); hdr /assets/css/main.min.css >/dev/null; A2=$(hdr /assets/css/main.min.css)
check "cache-control 1 ano"   'max-age=(31536000|2592000)' "$(val "$A" cache-control)"
check "cf-cache-status HIT"   'HIT'                        "$(val "$A2" cf-cache-status)"

echo
echo "-- 2. Compression Rule: brotli nos estáticos"
check "content-encoding br"   '^br$'                       "$(val "$A" content-encoding)"
J=$(hdr /assets/js/home.min.js)
check "brotli tambem no JS"   '^br$'                       "$(val "$J" content-encoding)"

echo
echo "-- 3. Cache Rule: HTML na borda"
H=$(hdr /); hdr / >/dev/null; H2=$(hdr /)
check "cf-cache-status HTML"  'HIT|EXPIRED|REVALIDATED'    "$(val "$H2" cf-cache-status)"

echo
echo "-- 4. Transform Rule: cabeçalhos de segurança"
check "strict-transport-security" 'max-age=[0-9]+'         "$(val "$H" strict-transport-security)"
check "x-content-type-options"    'nosniff'                "$(val "$H" x-content-type-options)"
check "referrer-policy"           'strict-origin'          "$(val "$H" referrer-policy)"
check "permissions-policy"        'camera'                 "$(val "$H" permissions-policy)"
check "x-frame-options"           'SAMEORIGIN'             "$(val "$H" x-frame-options)"

echo
echo "-- 5. Já estava certo antes (não deve ter regredido)"
check "HTTP/3 anunciado"          'h3='                    "$(val "$H" alt-svc)"

echo
echo "-- 6. O CGV ainda embute? (X-Frame-Options SAMEORIGIN não pode ter virado DENY)"
XFO=$(val "$H" x-frame-options)
if printf '%s' "$XFO" | grep -qi 'DENY'; then
  printf '  \033[31mPERIGO\033[0m X-Frame-Options: DENY quebra o iframe do CGV na home\n'; FAIL=$((FAIL+1))
else
  printf '  \033[32mOK  \033[0m iframe do CGV preservado\n'; PASS=$((PASS+1))
fi

echo
echo "  $PASS ok, $FAIL pendente(s)"
[ "$FAIL" -eq 0 ]
