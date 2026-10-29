# Centro de mando hospitalario

Abre `index.html` en el navegador o sirve esta carpeta con un servidor web estático. No necesita una base de datos ni librerías JavaScript externas.

## Demostración rápida

1. Pulsa **Cargar 40 pacientes de prueba**. La secuencia es reproducible y programa dos llegadas por minuto.
2. Pulsa **Empeorar 3 pacientes**. El nivel clínico cambia en los mismos registros, sin crear pacientes nuevos.
3. Cambia entre **Prioridad dinámica** y **FIFO** y observa el orden de la cola.
4. Desactiva un consultorio. Si estaba atendiendo, el paciente vuelve a la cola y se reasigna sin perder su identificador.
5. Usa **Avanzar 1 min** para inspeccionar el envejecimiento, o **Iniciar simulación** para dejar correr las llegadas y atenciones.
6. Pulsa **Comparar resultados** para ejecutar ambos algoritmos sobre la misma secuencia de 40 pacientes.
7. En **Acciones operativas**, puedes admitir antes de tiempo la próxima llegada, empeorar el siguiente caso en cola, verificar integridad o descargar el reporte CSV.
8. Si un consultorio está ocupado, **Finalizar atención** libera al médico y asigna automáticamente el próximo caso.
9. Pulsa **Imprimir ficha** en un paciente de la cola o de un consultorio ocupado para abrir su comprobante listo para imprimir o guardar como PDF.
10. Los casos completados y los nombres quedan en **Pacientes atendidos** bajo la cola. Al registrar manualmente, ingresa el nombre completo para que aparezca en el historial y en la ficha.

**Regla de envejecimiento:** cada cinco minutos completos de espera mejora un nivel la prioridad efectiva, hasta llegar al nivel 1. En empates, se atiende primero a quien llegó antes.

## Estructuras implementadas

- `MinHeap`: heap binario manual utilizado en el modo de prioridad dinámica.
- `fifo`: arreglo ordenado por llegada para el modo FIFO.
- `PatientList`: lista enlazada que conserva el registro maestro de pacientes; un mapa auxiliar evita IDs duplicados.

El tablero verifica que el total registrado coincida con el total que permanece en el sistema, e informa duplicados y casos perdidos.
