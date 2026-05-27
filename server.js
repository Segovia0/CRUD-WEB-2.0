// 1. Importar módulos necesarios
const express = require('express');
const fs = require("fs");
const path = require('path'); // Requerido para manejar rutas de archivos estáticos

// 2. Instanciar la aplicación
const app = express();
let estudiantes = [];
let ciUltimoAsincrono = null;

// Funciones de Base de Datos
function leerbd() {
    try {
        let textJson = fs.readFileSync("bd.json", "utf8");
        estudiantes = JSON.parse(textJson).estudiantes;
    } catch (error) {
        estudiantes = []; // En caso de que el archivo no exista inicialmente
    }
    return estudiantes;
}

function guardarbd() {
    let obj = JSON.stringify({ estudiantes: estudiantes }, null, 2);
    fs.writeFileSync("bd.json", obj);
}

// 3. Configurar Middleware
app.use(express.static('public')); // Asegúrate de que tus .html estén dentro de la carpeta 'public'
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Permite al servidor entender JSON enviado desde el frontend

// --- YA NO SE USA: app.set('view engine', 'ejs'); ---

// ==========================================
// 1. RUTAS PARA SERVIR LAS VISTAS (HTML)
// ==========================================

// Ruta principal (Menú)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Formulario de registro
app.get('/nuevo-alumno', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'formulario.html'));
});

// Lista de estudiantes
app.get('/estudiantes', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'lista_estudiantes.html'));
});

// Vista de éxito al registrar
app.get('/exito', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'exito.html'));
});

// Formulario de edición (Ahora sirve un HTML fijo, los datos se pedirán por Fetch)
app.get('/editar/:ci', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'editar_estudiante.html'));
});


// ==========================================
// 2. RUTAS DE LA API (PROCESAN DATOS JSON)
// ==========================================

// 1. Obtener la lista para la carga inicial (Muestra todos MENOS el nuevo)
// Obtener la lista completa de estudiantes (Para la carga inicial automática)
app.get('/api/estudiantes', (req, res) => {
    leerbd(); // Sincroniza el arreglo en memoria con el archivo bd.json
    
    // Si hay un alumno nuevo registrado en esta sesión de formulario...
    if (ciUltimoAsincrono) {
        // 🛡️ Forzamos a que ambas Cédulas se comparen estrictamente como Números
        let historialViejo = estudiantes.filter(e => Number(e.ci) !== Number(ciUltimoAsincrono));
        
        // Devolvemos el historial viejo (El nuevo se queda oculto en el backend)
        return res.json(historialViejo);
    }
    
    // Si no hay registros nuevos pendientes por actualizar, mandamos todo normal
    res.json(estudiantes);
});




// Obtener los datos de UN solo estudiante (Para rellenar el formulario de edición)
app.get('/api/estudiantes/:ci', (req, res) => {
    leerbd();
    let ciBuscar = Number(req.params.ci);
    let alumno = estudiantes.find(e => e.ci === ciBuscar);
    if (alumno) {
        res.json(alumno);
    } else {
        res.status(404).json({ error: "Estudiante no encontrado" });
    }
});

// Obtener ÚNICAMENTE el último estudiante registrado
app.get('/api/ultimo-estudiante', (req, res) => {
    leerbd(); 
    
    if (estudiantes.length > 0) {
        let ultimo = estudiantes[estudiantes.length - 1];
        
        // 🌟 ¡LA CLAVE AQUÍ! 
        // Como el frontend ya vino a buscar al último alumno para meterlo en la tabla,
        // rompemos el bloqueo en el servidor igualándolo a null.
        ciUltimoAsincrono = null; 
        
        res.json(ultimo);
    } else {
        res.status(404).json({ error: "No hay estudiantes registrados" });
    }
});


// ✅ CORREGIDO: Guardar un nuevo alumno de forma asíncrona (Método POST)
// 3. Guardar un nuevo alumno
app.post('/guardar-alumno', (req, res) => {
    leerbd();
    
    let ci = Number(req.body.ci);
    let nombre = req.body.nombre;
    let apellido = req.body.apellido;
    let nota1 = Number(req.body.nota1);
    let nota2 = Number(req.body.nota2);
    let nota3 = Number(req.body.nota3);
    let nota4 = Number(req.body.nota4);

    if (String(ci).length > 8) {
        return res.status(400).json({ error: "La cédula no puede tener más de 8 dígitos." });
    }
    
    let promedio = (nota1 + nota2 + nota3 + nota4) / 4;
    
    let nuevoAlumno = { 
        ci: ci, 
        nombre: nombre, 
        apellido: apellido, 
        nota1: nota1, 
        nota2: nota2, 
        nota3: nota3, 
        nota4: nota4,
        promedio: promedio.toFixed(2)
    };

    estudiantes.push(nuevoAlumno);
    
    // 🌟 CLAVE: Registramos esta CI como la "nueva" para ocultarla de la carga inicial
    ciUltimoAsincrono = ci; 
    
    guardarbd();
    
    res.status(201).json({ mensaje: "Estudiante guardado en el backend" });
});



// ✅ REVISADO: Actualizar los datos de un alumno de forma asíncrona (Método POST)
app.post('/actualizar-alumno', (req, res) => {
    leerbd();
    let ciOriginal = Number(req.body.ciOriginal);
    let nuevaCi = Number(req.body.ci);
    let nuevoNombre = req.body.nombre;
    let nuevoApellido = req.body.apellido;
    let nuevaNota1 = Number(req.body.nota1);
    let nuevaNota2 = Number(req.body.nota2);
    let nuevaNota3 = Number(req.body.nota3);
    let nuevaNota4 = Number(req.body.nota4);
    
    let nuevoPromedio = (nuevaNota1 + nuevaNota2 + nuevaNota3 + nuevaNota4) / 4;
    
    let indice = estudiantes.findIndex(e => e.ci === ciOriginal);
    
    if (indice !== -1) {
        estudiantes[indice] = { 
            ci: nuevaCi, 
            nombre: nuevoNombre, 
            apellido: nuevoApellido,
            nota1: nuevaNota1,
            nota2: nuevaNota2,
            nota3: nuevaNota3,
            nota4: nuevaNota4,
            promedio: nuevoPromedio.toFixed(2)
        };
        guardarbd();
        
        // Confirmación JSON limpia al frontend
        res.status(200).json({ mensaje: "Estudiante actualizado correctamente" });
    } else {
        res.status(404).json({ error: "Estudiante no encontrado." });
    }
});


// Eliminar un estudiante
app.get('/eliminar/:ci', (req, res) => {
    leerbd();
    let ciBuscar = Number(req.params.ci);
    estudiantes = estudiantes.filter(e => e.ci !== ciBuscar);
    guardarbd();
    res.redirect('/estudiantes');

});

// 4. Iniciar servidor
const PUERTO = 3000;
app.listen(PUERTO, () => {
    console.log(`Servidor de la UPTT corriendo en http://localhost:${PUERTO}`);
});
