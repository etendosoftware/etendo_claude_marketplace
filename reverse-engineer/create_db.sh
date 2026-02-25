#!/bin/bash

# Usuario predeterminado (hardcodeado)
db_user="postgres"

# Verificar si se proporcionó el número correcto de argumentos
if [ $# -ne 2 ]; then
    echo "Error: Debes proporcionar el nombre de la base de datos y el puerto."
    echo "Uso: $0 <nombre_base_datos> <puerto>"
    exit 1
fi

# Asignar los argumentos a variables
db_name="$1"
db_port="$2"

# Verificar si el puerto es un número entero
if ! [[ "$db_port" =~ ^[0-9]+$ ]]; then
    echo "Error: El puerto debe ser un número entero."
    exit 1
fi

# Verificar si la base de datos ya existe
if PGPASSWORD=syspass psql -h "localhost" -U "$db_user" -p "$db_port" -lqt | cut -d \| -f 1 | grep -qw "$db_name"; then
    echo "Error: La base de datos '$db_name' ya existe."
    exit 1
fi

# Crear la nueva base de datos
PGPASSWORD=syspass psql -h "localhost" -U "$db_user" -p "$db_port" -c "CREATE DATABASE $db_name WITH ENCODING='UTF8' OWNER=tad;"

if [ $? -eq 0 ]; then
    echo "La base de datos '$db_name' se ha creado correctamente en el puerto $db_port."
else
    echo "Error: No se pudo crear la base de datos '$db_name' en el puerto $db_port."
fi
