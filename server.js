const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'contacts.json');

// MIME types for serving static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf'
};

// Initialize contacts file if it doesn't exist
function initializeContactsFile() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
        console.log('Created contacts.json file');
    }
}

// Save contact message to JSON file
function saveContact(data) {
    try {
        let contacts = [];
        if (fs.existsSync(DATA_FILE)) {
            const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
            contacts = JSON.parse(fileContent);
        }
        
        contacts.push(data);
        fs.writeFileSync(DATA_FILE, JSON.stringify(contacts, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving contact:', error);
        return false;
    }
}

// Serve static files
function serveStaticFile(filePath, res) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
}

// Parse JSON body
function parseBody(req, callback) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            callback(null, data);
        } catch (error) {
            callback(error, null);
        }
    });
}

// Create server
const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    // API endpoint for contact form
    if (pathname === '/api/contact' && req.method === 'POST') {
        parseBody(req, (err, data) => {
            if (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
                return;
            }
            
            // Validate required fields
            if (!data.name || !data.email || !data.subject || !data.message) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing required fields' }));
                return;
            }
            
            // Add timestamp and ID if not present
            if (!data.timestamp) {
                data.timestamp = new Date().toISOString();
            }
            if (!data.id) {
                data.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
            }
            
            const saved = saveContact(data);
            
            if (saved) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    message: 'Contact saved successfully',
                    id: data.id 
                }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to save contact' }));
            }
        });
        return;
    }
    
    // API endpoint to get all contacts (for admin use)
    if (pathname === '/api/contacts' && req.method === 'GET') {
        try {
            if (fs.existsSync(DATA_FILE)) {
                const content = fs.readFileSync(DATA_FILE, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(content);
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify([]));
            }
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to read contacts' }));
        }
        return;
    }
    
    // Serve static files
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }
    
    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            // Try serving index.html for SPA routing
            const indexPath = path.join(__dirname, 'index.html');
            serveStaticFile(indexPath, res);
        } else {
            serveStaticFile(filePath, res);
        }
    });
});

// Initialize and start server
initializeContactsFile();

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Press Ctrl+C to stop the server`);
});
