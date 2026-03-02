\-Enunciado de actividad integradora 

 1\. Crear nuevos repositorios llamados int\_com.smf.tutorial.\<nombre\>.\<apellido\> y int\_com.smf.tutorial.template.\<nombre\>.\<apellido\> 

**Cada ejercicio deberá de contar con su correspondiente commit en una rama salida de master y luego mergearlo nuevamente a master.** 

**Agregar a los repositorios los pipelines para que se ejecute Sonar y el bot de code review: [Configurar pipeline para integrar Code Reviews automáticas y SonarQube en Pull Requests | Configurar Pipelines](https://etendoproject.atlassian.net/wiki/spaces/KB/pages/2974121985/Configurar+pipeline+para+integrar+Code+Reviews+autom+ticas+y+SonarQube+en+Pull+Requests#Configurar-Pipelines)**

2\. Crear el módulo com.smf.tutorial y su correspondiente template com.smf.tutorial.template 

Módulo: 

● El lenguaje deberá ser Inglés (en\_US) 

● El prefijo de Base de datos deberá ser SMFT para el módulo 

● Como dependencia deberá tener el framework 3.0 de core 

● Colocar el correcto paquete de datos a utilizar. 

Template 

● El lenguaje deberá ser Inglés (en\_US) 

● Como dependencia el módulo previamente creado y agregando el módulo antes creado dentro de los módulos incluido en el template. 

3\. Se espera realizar un módulo que permita gestionar cursos, asignaturas, docentes y alumnos, se usarán tablas existentes para representar parte de esta estructura: 

● Curso \=\> Producto

● Docente \=\> Usuarios

● Alumnos \=\> Tercero

Los productos deberán de contar con un check dentro de la tabla de producto que nos indique si uno es o no un curso y su duración (cantidad de meses). 

Se deberá modelar una tabla que represente las asignaturas donde tendrá que contener la siguiente información **obligatoria**:

● código (numérico) 

● nombre (cadena de texto) 

● Docente (referencia a usuario) (suponemos que una asignatura siempre la dictara un solo docente) 

● tipo de dictado (lista cerrada de Anual, 1er Cuatrimestre, 2do Cuatrimestre). 

Se deberá permitir que un curso tenga más de una asignatura y una asignatura esté en más de un curso, se recomienda utilizar una tabla que represente instancia para ediciones de curso (2019, 2020, 2021, etc). 

Se deberá permitir que un alumno se inscriba a varios cursos. 

También se deberá poder modelar que cada asignatura puede tener evaluaciones, donde cada una de esta deberá de tener una descripción obligatoria de los temas (campo de texto) y numeración de la evaluación. 

Cada una de estas deberá de tener preguntas multiple choice las cuales están numeradas y contendrán el enunciado. Junto a esto, cada una tiene sus correspondientes opciones, y donde se deberá indicar si una respuesta es correcta o no. 

Una vez modelado esto, se tendrá que generar una ventana de Curso que contenga la siguiente estructura de solapas: 

Curso 

| 

|---\> Edición de Curso 

|---\> Alumnos (sólo lectura) 

|---\> Asignaturas

| 

|---\> Evaluación 

|---\> Preguntas 

|---\> Respuestas 

se deberá de solo mostrar los productos que son cursos.  

**(\*) Recordar no tener Templates en desarrollo al momento de hacer synchronize terminology**

4\. Generar un reporte Jasper que nos imprima la evaluación con sus preguntas en negrita, incluyendo su numeración y luego listado de las respuestas correspondientes, como título del reporte será el nombre de la asignatura y el número de evaluacion, debera de mostrar la descripción a modo de resumen de los temas a evaluar. 

7\. Crear un proceso desde la definición de procesos el cual dado un alumno, un curso y una fecha genere la inscripción del mismo, dicho proceso se lanzará desde una entrada de menú. 

6\. Crear una columna computada dentro de la ventana tercero y contenida en un grupo de campos llamado alumnos, donde se indique cual es el curso que se vence primero. 

5\. Crear un EventHandler el cual nos permita controlar que cada vez que se inscriba un alumno registre la fecha desde y la fecha hasta calculada con la duración del curso  en el momento de la inscripción además de chequear que no puede estar cursando 2 veces el mismo curso (a no ser que sea una reinscripción luego que el las otras instancias de inscripción, el cursado ya estaba cerrado). ./

8\. Crear un proceso en background el cual se ejecute todos los días y actualice todas las inscripciones que se vencieron el día anterior para esto deberá también hacer uso de un criterio. 

9\. Crear un proceso que internamente use OBQuery, Criteria o Query de hibernate que permita desde un curso seleccionar un alumno y un valor que será el puntaje del alumno lo almacene en la inscripción vigente del mismo, si no está inscripto que informe un error.

10\. Modificar el menú, ventana y solapa de terceros con el nombre de 

alumnos. 

**Siéntanse libres de agregar todo lo que vean necesario para completar el modelo.** 