# Mis gastos

Aplicación web adaptable para registrar movimientos personales, clasificarlos y revisar el resumen mensual por categoría y tipo.

## Cómo usarla

En Windows, haz doble clic en `INICIAR.bat`; también puedes abrir `index.html` en un navegador moderno. No requiere instalar dependencias ni ejecutar un servidor.

Para compartir la app, envía el archivo ZIP portable. Cada persona tendrá sus propios movimientos guardados en su navegador; el paquete no incluye tus datos.

## Publicar en GitHub Pages

El flujo de GitHub Actions de `.github/workflows/pages.yml` publica la app automáticamente en GitHub Pages cada vez que se actualiza la rama `main`. En el repositorio, selecciona **Settings → Pages → Build and deployment → GitHub Actions**. El flujo publica solo los archivos de la app; no publica este README ni el lanzador de Windows.

Al abrir el enlace desde un celular, se puede agregar la app a la pantalla de inicio desde el menú del navegador. La app y los movimientos guardados funcionan sin conexión después de la primera carga. Los movimientos permanecen en el almacenamiento local de cada navegador y no se sincronizan entre dispositivos.

Al pasar de la versión abierta como archivo a la versión publicada, descarga una copia desde la app anterior y restáurala en la publicada: el navegador trata ambas direcciones como espacios de almacenamiento distintos.

## Funciones

- Registra gastos e ingresos, además de pagos a tarjetas, pagos a entidades y transferencias entre cuentas.
- Los pagos a tarjetas y a entidades cuentan como gastos necesarios de la categoría “Obligaciones o deudas”. Las transferencias propias quedan registradas, pero no se suman como ingreso ni gasto.
- Una transferencia propia asociada a Nu se clasifica automáticamente como “Ahorro” y aparece en su categoría y subtotal. No se suma al gasto total, pero sí se descuenta del saldo neto del flujo de caja. Las transferencias a otras cuentas siguen siendo movimientos neutros.
- En el flujo de caja, las compras pagadas con Nu o Bogotá no se descuentan en el mes de compra; el desembolso se refleja cuando se registra el pago a la tarjeta. Los demás gastos pagados directamente y los ahorros en Nu se descuentan en su mes.
- El gráfico “Movimiento total del dinero” muestra todas las entradas y salidas brutas, sin aplicar esas reglas. Puede contar dos salidas si registras tanto una compra con tarjeta como su pago posterior.
- Consulta por separado los pagos a tarjetas y entidades dentro del resumen mensual.
- El desglose “Gastos con tarjeta” muestra solo compras con Nu y Bogotá; excluye pagos directos y abonos a tarjetas.
- Clasifica las devoluciones como entradas de dinero y consulta el saldo neto del flujo (ingresos menos salidas pagadas y ahorros en Nu).
- Los gastos incluyen nombre, fecha, categoría, tipo, tarjeta usada (Nu, Bogotá o No aplica) y valor.
- Maneja COP y USD. Para cada movimiento en USD, ingresa la tasa USD → COP que quieres usar; esa tasa queda asociada al movimiento.
- Consulta totales mensuales, gastos necesarios y hormiga, distribución por categoría (incluido el ahorro), tipo y tarjeta.
- Filtra la lista por mes, movimiento, categoría, tipo y tarjeta; puedes cambiar el medio de pago de uno o varios movimientos, o eliminarlos.
- Guarda automáticamente la información en el almacenamiento local del navegador. Usa “Descargar copia” para guardar un respaldo JSON y “Restaurar copia” para agregar sus movimientos sin borrar los actuales.

No hay sincronización entre dispositivos: si borras los datos del navegador, puedes restaurarlos desde una copia descargada. El archivo contiene información financiera; guárdalo en un lugar privado. Los gastos recurrentes aparecen en los reportes, pero la aplicación no crea movimientos futuros automáticamente.

Los movimientos guardados antes de agregar el campo de tarjeta aparecen como “Sin clasificar”; así no se asume que fueron pagados con una tarjeta específica.
