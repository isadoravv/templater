import express from 'express';
import path from 'path';
import fs from 'fs';
import { getFrenchFormattedDate, fetchTemplate, generateReport, ensureDirectoryExists, getAirtableSchema, processFieldsForDocx, getAirtableRecords, getAirtableRecord } from './utils.js';
// import { WebSocketServer } from 'ws';

const app = express();
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Set EJS as the templating engine
// app.set('view engine', 'ejs');
// app.set('views', path.join(process.cwd(), 'views'));

// const wss = new WebSocketServer({ noServer: true });

// wss.on('connection', (ws) => {
  // ws.send('Server is running on port 3000');
// });

//export function broadcastLog(message) {
// wss.clients.forEach((client) => {
  // if (client.readyState === client.OPEN) {
// client.send(message);
// }
// });
// }

app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'index.html'));
});

app.get('/schemas', async (req, res) => {
  try {
    const schema = await getAirtableSchema();
    if (!schema) {
      console.log('Failed to retrieve schema.');
      return res.status(500).json({ success: false, error: 'Failed to retrieve schema.' });
    }
    // Extract only the names of the fields
    let mdFieldsSession = schema.find(table => table.name === 'Sessions').fields
    // let mdFieldsSession = schema.find(table => table.name === 'Sessions').fields
    .filter(field => {
      if (field.type === 'richText') {
        return field.name;
      } else if (field.type === 'multipleLookupValues') {
        if (field.options.result.type === 'richText') return field.name;
      } else {
        return null;
      }
    })
    .map(field => field.name); // Map to only field names
    
    res.json({champsMarkdown: mdFieldsSession});
  } catch (error) {
    console.error('Error fetching schema:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});



app.get('/catalogue', async (req, res) => {
  // res.sendFile(path.join(process.cwd(), 'index.html'));
  const table = "Sessions";
  const view = "Catalogue";
  try {
    const data = await getAirtableRecords(table, view);
    if (data) {
      console.log('Data successfully retrieved:', data.records.length, "records");
      // broadcastLog(`Data successfully retrieved: ${data.records.length} records`);
    } else {
      console.log('Failed to retrieve data.');
      // broadcastLog('Failed to retrieve data.');
    }
    
    // Generate and send the report
    await generateAndSendReport('https://github.com/isadoravv/templater/raw/refs/heads/main/templates/catalogue.docx', data, res);
    // res.render('index', { title: 'Catalogue', heading: `Catalogue : à partir de ${table}/${view}` });
  } catch (error) {
    console.error('Error:', error);
    // broadcastLog(`Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
  
});

app.get('/programme', async (req, res) => {
  // res.sendFile(path.join(process.cwd(), 'index.html'));
  const table="Sessions";
  // const recordId="recAzC50Q7sCNzkcf";
  const { recordId } = req.query;
  
  if (!recordId) {
    return res.status(400).json({ success: false, error: 'Paramètre recordId manquant.' });
  }
  try {
    const data = await getAirtableRecord(table, recordId);
    if (data) {
      console.log('Data successfully retrieved:', data.length);
      // broadcastLog(`Data successfully retrieved: ${data.length} records`);
    } else {
      console.log('Failed to retrieve data.');
      // broadcastLog('Failed to retrieve data.');
    }
    
    // Generate and send the report
    await generateAndSendReport('https://github.com/isadoravv/templater/raw/refs/heads/main/templates/programme.docx', data, res);
    // res.render('index', { title: `Générer un Programme pour ${recordId}`, heading: 'Programme' });
  } catch (error) {
    console.error('Error:', error);
    // broadcastLog(`Error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
  
});  


// Reusable function to generate and send report
async function generateAndSendReport(url, data, res) {
  try {
    console.log('Generating report...');
    // broadcastLog('Generating report...');
    const template = await fetchTemplate(url);
    const buffer = await generateReport(template, data);
    
    const originalFileName = path.basename(url);
    const fileNameWithoutExt = originalFileName.replace(path.extname(originalFileName), '');
    let newTitle =fileNameWithoutExt
    switch (fileNameWithoutExt) {
      case 'catalogue':
        // newTitle = 'Catalogue des formations FSH' + next year
        newTitle = 'Catalogue des formations FSH ' + (new Date().getFullYear() +1);
        break;
      case 'programme':
        newTitle = data.titre_fromprog || "Programme";
        break;
      default:
        break;
    }
    const newFileName = `${getFrenchFormattedDate()}-${newTitle}.docx`;
    
    const reportsDir = path.join(process.cwd(), 'reports');
    ensureDirectoryExists(reportsDir);
    
    const filePath = path.join(reportsDir, newFileName);
    fs.writeFileSync(filePath, buffer);
    
    console.log(`Report generated: ${filePath}`);
    // broadcastLog(`Report generated: ${filePath}`);
    
    // Send the file as a download
    res.download(filePath, newFileName, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        // broadcastLog('Error sending file.');
        res.status(500).send('Could not download the file.');
      } else {
        console.log('File generated successfully.');
        // broadcastLog('File sent successfully.');
        // res.status(200).json({ success: true, message: 'File generated successfully.' });
      }
    });
    
  } catch (error) {
    console.error('Error generating report:', error);
    // broadcastLog(`Error generating report: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Start the server
const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port http://localhost:${process.env.PORT || 3000}/`);
});

// server.on('upgrade', (request, socket, head) => {
//   wss.handleUpgrade(request, socket, head, (ws) => {
//     wss.emit('connection', ws, request);
//   });
// });

