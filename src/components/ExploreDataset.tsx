import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

import { ExploreDatasetProps, FileStructure, Piece } from './types';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coy } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  Folder, 
  File, 
  FileText, 
  FileImage, 
  FileVideo, 
  FileSpreadsheet,
  FileJson,
  ChevronRight,
  FileCode,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

const TOOL_LINKS = {
  boost: { name: 'Boost', url: 'https://boost.filecoin.io' },
  lassie: { name: 'Lassie', url: 'https://docs.filecoin.io/basics/how-retrieval-works/basic-retrieval' },
  lotus: { name: 'Lotus client', url: 'https://lotus.filecoin.io/lotus/get-started/what-is-lotus/' },
} as const;

/** File entry represents a single Piece (e.g. `{piece_cid}.car` in the manifest). */
function isWholePieceFile(
  file: FileStructure,
  payloadCid: string | null,
  pieces?: Piece[],
): boolean {
  if (!file.piece_cid) return false;
  if (file.name === `${file.piece_cid}.car`) return true;
  const piece = pieces?.find((p) => p.piece_cid === file.piece_cid);
  return Boolean(piece && payloadCid && piece.payload_cid === payloadCid);
}

function StorageStatusLinks({ pieceCid }: { pieceCid: string }) {
  return (
    <a
      href={`https://filecoin.tools/search?q=${pieceCid}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-chart-1 hover:text-chart-1/80 underline flex items-center gap-1"
    >
      Check on filecoin.tools
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function RetrievalToolSelector({
  selectedTool,
  onToolChange,
}: {
  selectedTool: 'boost' | 'lassie' | 'lotus';
  onToolChange: (tool: 'boost' | 'lassie' | 'lotus') => void;
}) {
  return (
    <div className="border-t pt-4">
      <label className="text-sm font-medium mb-2 block">Choose Retrieval Tool</label>
      <ToggleGroup
        type="single"
        value={selectedTool}
        onValueChange={(value) => {
          if (value === 'boost' || value === 'lassie' || value === 'lotus') {
            onToolChange(value);
          }
        }}
        variant="outline"
        size="default"
        className="shadow-md"
      >
        <ToggleGroupItem
          value="lassie"
          aria-label="Lassie"
          className="data-[state=on]:bg-white data-[state=on]:text-foreground data-[state=off]:bg-muted data-[state=off]:text-muted-foreground"
        >
          Lassie
        </ToggleGroupItem>
        <ToggleGroupItem
          value="boost"
          aria-label="Boost"
          className="data-[state=on]:bg-white data-[state=on]:text-foreground data-[state=off]:bg-muted data-[state=off]:text-muted-foreground"
        >
          Boost
        </ToggleGroupItem>
        <ToggleGroupItem
          value="lotus"
          aria-label="Lotus"
          className="data-[state=on]:bg-white data-[state=on]:text-foreground data-[state=off]:bg-muted data-[state=off]:text-muted-foreground"
        >
          Lotus
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

// Download Instructions Component
function DownloadInstructions({ dataset, selectedFile, selectedCid, getFileIcon }: { dataset: any; selectedFile: FileStructure | null; selectedCid: string | null; getFileIcon: (file: FileStructure) => JSX.Element }) {
  const [selectedTool, setSelectedTool] = useState<'boost' | 'lassie' | 'lotus'>('lassie');
  const [copied, setCopied] = useState(false);
  const [copiedCar, setCopiedCar] = useState(false);

  const pieceCount = dataset.pieces?.length ?? 0;

  const buildRetrieveCommand = (cid: string, outputName: string) => {
    switch (selectedTool) {
      case 'boost':
        return `boost retrieve --provider <provider> -o ${outputName} ${cid}`;
      case 'lassie':
        return `lassie fetch ${cid} -o ${outputName}`;
      case 'lotus':
        return `lotus client retrieve --miner <provider> ${cid} ${outputName}`;
    }
  };

  const getFileDownloadCommand = () => {
    if (!selectedFile || !selectedCid) return '';
    const outputName = selectedFile.name.replace(/\s+/g, '_');
    return buildRetrieveCommand(selectedCid, outputName);
  };

  const getCarDownloadCommand = () => {
    if (!selectedFile?.piece_cid) return '';
    return buildRetrieveCommand(selectedFile.piece_cid, `${selectedFile.piece_cid}.car`);
  };

  const getToolDescription = () => {
    switch (selectedTool) {
      case 'boost':
        return 'Retrieve from a specific storage provider using the Filecoin boost client.\nUse the links above to find a storage provider and pass its actor ID as <provider>.';
      case 'lassie':
        return 'Retrieve using Lassie, a simple Filecoin retrieval client.\nLassie will find an appropriate storage provider automatically.';
      case 'lotus':
        return 'Retrieve from a specific storage provider using Lotus, the reference Filecoin implementation.\nUse the links above to find a storage provider and pass its actor ID as <provider>.';
    }
  };

  const handleCopyCommand = async () => {
    const command = getFileDownloadCommand();
    if (!command) return;
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCarCommand = async () => {
    const command = getCarDownloadCommand();
    if (!command) return;
    await navigator.clipboard.writeText(command);
    setCopiedCar(true);
    setTimeout(() => setCopiedCar(false), 2000);
  };

  const command = getFileDownloadCommand();
  const carCommand = getCarDownloadCommand();
  const tool = TOOL_LINKS[selectedTool];
  const isWholePiece =
    selectedFile != null && isWholePieceFile(selectedFile, selectedCid, dataset.pieces);
  const canDownloadFile = selectedFile && (selectedCid || (isWholePiece && selectedFile.piece_cid));

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Dataset summary — always visible */}
      <div className="space-y-3 pb-4">
        <div className="flex items-center gap-2">
          <Folder className="h-5 w-5 text-chart-2" />
          <span className="font-medium text-lg">{dataset.name}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Size:</span>
            <span className="ml-2">{dataset.size} - stored in {pieceCount} Pieces</span>
          </div>
          {dataset.uploadDate && (
            <div>
              <span className="text-muted-foreground">Upload Date:</span>
              <span className="ml-2">{new Date(dataset.uploadDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>
        {dataset.description && (
          <div>
            <span className="text-muted-foreground text-sm">Description:</span>
            <p className="text-sm text-foreground mt-1">{dataset.description}</p>
          </div>
        )}
        
      </div>

      <div className="pt-4">
        <div className="download-instructions space-y-6">
          <section
            className="download-instructions__full-dataset space-y-3 pb-4 border-b border-border"
            aria-labelledby="download-instructions-full-dataset-heading"
          >
            <h3 id="download-instructions-full-dataset-heading" className="text-sm font-semibold">
              Download whole dataset
            </h3>
            <div className="text-sm text-muted-foreground p-4 bg-muted rounded">
              To download the whole dataset, download the manifest then pass it to the Filecoin Large Dataset Retrieval Tool.
            </div>
          </section>

          <section
            className="download-instructions__selected-entry space-y-4"
            aria-labelledby="download-instructions-selected-entry-heading"
          >
            <h3 id="download-instructions-selected-entry-heading" className="text-sm font-semibold">
              {isWholePiece ? 'Download single Piece' : 'Download individual files'}
            </h3>

            {!selectedFile ? (
              <p className="text-sm text-muted-foreground p-4 bg-muted rounded">
                To download individual files, select a file from the directory tree.
              </p>
            ) : !canDownloadFile ? (
              <p className="text-sm text-muted-foreground p-4 bg-muted rounded">
                This entry does not have a CID available for retrieval. Select a different file from the directory tree.
              </p>
            ) : (
              <div
                key={`download-entry-${selectedCid}-${selectedFile.path ?? selectedFile.id}`}
                className="space-y-4"
              >
                <div className="space-y-3 pb-2">
                  <div className="flex items-center gap-2">
                    {getFileIcon(selectedFile)}
                    {isWholePiece && selectedFile.piece_cid ? (
                      <span className="font-medium font-mono text-sm break-all">
                        {selectedFile.piece_cid}
                        {selectedFile.size ? ` (${selectedFile.size})` : ''}
                      </span>
                    ) : (
                      <span className="font-medium">{selectedFile.name}</span>
                    )}
                  </div>
                  {!isWholePiece && (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Type:</span>
                          <span className="ml-2 capitalize">{selectedFile.mimeType || selectedFile.type}</span>
                        </div>
                        {selectedFile.size && (
                          <div>
                            <span className="text-muted-foreground">Size:</span>
                            <span className="ml-2">{selectedFile.size}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground text-sm">CID:</span>
                        <span className="ml-2 font-mono text-sm text-foreground break-all">{selectedCid}</span>
                      </div>
                    </>
                  )}
                </div>

                {selectedFile.piece_cid && (
                  <div className="pt-4 pb-2">
                    <h4 className="text-sm font-medium mb-2">Storage Status</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      This file is stored in Piece {selectedFile.piece_cid}.
                    </p>
                    <StorageStatusLinks pieceCid={selectedFile.piece_cid} />
                  </div>
                )}

                <RetrievalToolSelector selectedTool={selectedTool} onToolChange={setSelectedTool} />

                <div>
                  <div className="text-sm text-muted-foreground mb-3 whitespace-pre-line">
                    {getToolDescription()}
                  </div>

                  {command && !isWholePiece && (
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Command</label>
                        <Button variant="outline" size="sm" onClick={handleCopyCommand} className="h-7">
                          {copied ? (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="bg-muted rounded-md p-3 font-mono text-sm break-all">{command}</div>
                    </div>
                  )}

                  {carCommand && selectedFile.piece_cid && (
                    <div className={`space-y-2 ${isWholePiece ? '' : 'pt-4 border-t'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium">
                            {isWholePiece ? 'Download the entire Piece CAR' : 'Or download the entire Piece CAR'}
                          </label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Using piece CID: <span className="font-mono">{selectedFile.piece_cid.slice(0, 16)}...</span>
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleCopyCarCommand} className="h-7">
                          {copiedCar ? (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="bg-muted rounded-md p-3 font-mono text-sm break-all">{carCommand}</div>
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  Don&apos;t have {tool.name.toLowerCase()}?{' '}
                  <a
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-chart-1 hover:text-chart-1/80 underline"
                  >
                    Get started here.
                  </a>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// Manifest Viewer Component
function ManifestViewer({ dataset }: { dataset: any }) {
  const [manifestContent, setManifestContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchManifest = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Check if we're in development mode (localhost:5173) or production
        const isDevelopment = window.location.hostname === 'localhost' && window.location.port === '5173';
        const apiBaseUrl = isDevelopment ? 'http://localhost:3000/api' : '/api';
        // Prefer direct file path if available; fallback to dataset-based endpoint
        const manifestUrl = dataset.manifestFile
          ? `${apiBaseUrl}/files/${dataset.manifestFile}`
          : `${apiBaseUrl}/files/manifest/${dataset.id}`;
        
        console.log('🔍 Fetching manifest from:', manifestUrl);
        console.log('🔍 Dataset ID:', dataset.id);
        console.log('🔍 Dataset manifestFile:', dataset.manifestFile);
        
        // Try to fetch the manifest file directly from the API
        const response = await fetch(manifestUrl);
        
        console.log('🔍 Response status:', response.status);
        console.log('🔍 Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('🔍 Error response body:', errorText);
          throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
        }
        
        const manifestText = await response.text();
        console.log('🔍 Manifest content preview:', manifestText.substring(0, 200));
        setManifestContent(manifestText);
      } catch (err) {
        console.error('Error fetching manifest:', err);
        setError(err instanceof Error ? err.message : 'Failed to load manifest');
      } finally {
        setIsLoading(false);
      }
    };

    if (dataset.id) {
      fetchManifest();
    }
  }, [dataset.id]);

  if (isLoading) {
    return (
      <div className="h-[55vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-chart-1 mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading manifest...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[55vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive mb-2">Error loading manifest</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[55vh] overflow-auto">
      <div className="p-4 bg-muted rounded" style={{ minWidth: 'max-content' }}>
        <SyntaxHighlighter
          language="json"
          style={coy}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: '0.875rem',
            lineHeight: '1.5',
            backgroundColor: 'transparent',
            whiteSpace: 'pre'
          }}
        >
          {manifestContent}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export function ExploreDataset({ dataset }: ExploreDatasetProps) {
  const [selectedFile, setSelectedFile] = useState<FileStructure | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Payload / retrieval identifier for the selected tree entry (manifest may use `cid` and/or `hash`)
  const selectedCid = (() => {
    if (!selectedFile) return null;
    if (selectedFile.type === 'file' || selectedFile.type === 'directory') {
      return selectedFile.cid || selectedFile.hash || null;
    }
    if (selectedFile.type === 'split-file') {
      return null; // NYI
    }
    return null;
  })();

  const getFileIcon = (file: FileStructure) => {
    const mimeType = file.mimeType?.toLowerCase() || '';
    
    if (file.type === 'directory') {
      return <Folder className="h-4 w-4 text-chart-2" />;
    }
    
    if (file.type === 'split-file') {
      return <FileVideo className="h-4 w-4 text-chart-4" />; // Use video icon for split files
    }
    
    if (mimeType.includes('image')) {
      return <FileImage className="h-4 w-4 text-chart-3" />;
    }
    if (mimeType.includes('video')) {
      return <FileVideo className="h-4 w-4 text-chart-4" />;
    }
    if (mimeType.includes('json')) {
      return <FileJson className="h-4 w-4 text-chart-5" />;
    }
    if (mimeType.includes('csv') || mimeType.includes('spreadsheet')) {
      return <FileSpreadsheet className="h-4 w-4 text-chart-1" />;
    }
    if (mimeType.includes('pdf')) {
      return <FileText className="h-4 w-4 text-destructive" />;
    }
    if (mimeType.includes('text') || mimeType.includes('code') || mimeType.includes('script')) {
      return <FileCode className="h-4 w-4 text-chart-6" />;
    }
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFileTree = (files: FileStructure[], level = 0) => {
    return files.map((file, siblingIndex) => {
      const fileId = file.path ?? `${file.id}-${level}-${siblingIndex}-${file.name}`;
      const isExpanded = expandedFolders.has(fileId);
      const isSelected = selectedFile === file;
      
      return (
        <div key={fileId}>
          <div
            className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 ${
              isSelected ? 'bg-muted' : ''
            }`}
            onClick={() => {
              // Always select the item (file or directory)
              setSelectedFile(file);
              
              // If it's a directory, also toggle expand/collapse
              if (file.type === 'directory') {
                toggleFolder(fileId);
              }
            }}
            style={{ marginLeft: level * 20 }}
          >
            {file.type === 'directory' ? (
              <ChevronRight
                className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            ) : null}
            {getFileIcon(file)}
            <span className="text-sm truncate">{file.name}</span>
            {file.size && (
              <span className="text-xs text-muted-foreground ml-auto">
                {file.size}
              </span>
            )}
          </div>
          
          {file.type === 'directory' && isExpanded && file.children && (
            <div>{renderFileTree(file.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  const currentFiles = dataset.files || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-xl font-medium">{dataset.name}</h2>
          {dataset.projectUrl ? (
            <a 
              href={dataset.projectUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-chart-1 hover:text-chart-1/80 underline inline-flex items-center gap-1"
            >
              {new URL(dataset.projectUrl).hostname}
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">{dataset.origin}</p>
          )}
        </div>
      </div>

      {/* Explorer Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[70vh]">
        {/* File Tree */}
        <Card className="lg:col-span-1">
          <CardContent className="p-0">
            <Tabs defaultValue="files" className="w-full">
              <div className="px-4 pt-4 pb-2">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="files" className="text-xs">View as files</TabsTrigger>
                  <TabsTrigger value="manifest" className="text-xs">View as manifest</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="files" className="mt-2">
                <div className="px-4 pb-2">
                  <div 
                    className="flex items-center gap-2 mb-3 cursor-pointer hover:bg-muted/50 rounded p-2 -m-2 transition-colors"
                    onClick={() => setSelectedFile(null)}
                  >
                    <Folder className="h-4 w-4 text-chart-2" />
                    <span className="text-sm font-medium">{dataset.name} Dataset</span>
                  </div>
                </div>
                <ScrollArea className="h-[55vh] px-4">
                  {currentFiles.length > 0 ? (
                    renderFileTree(currentFiles)
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      <File className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No files available for exploration</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="manifest" className="mt-2">
                <div className="px-4">
                  <ManifestViewer dataset={dataset} />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Download Instructions */}
        <Card className="lg:col-span-2">
          <CardContent className="h-[calc(70vh-4rem)] p-0">
            <ScrollArea className="h-full">
              <div className="p-6">
                <DownloadInstructions dataset={dataset} selectedFile={selectedFile} selectedCid={selectedCid} getFileIcon={getFileIcon} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}