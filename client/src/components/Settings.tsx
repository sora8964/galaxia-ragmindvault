import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, RotateCcw } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import type { AppConfig, UpdateAppConfig } from '@shared/schema';

// Form validation schema
const settingsFormSchema = z.object({
  geminiApi: z.object({
    model: z.enum(['gemini-2.5-flash', 'gemini-2.5-pro']),
    temperature: z.number().min(0).max(2),
    topP: z.number().min(0).max(1),
    topK: z.number().int().min(1).max(40),
    maxOutputTokens: z.number().int().min(1).max(8192),
    systemInstructions: z.string(),
    safetySettings: z.object({
      harassment: z.enum(['BLOCK_NONE', 'BLOCK_LOW_AND_ABOVE', 'BLOCK_MEDIUM_AND_ABOVE', 'BLOCK_HIGH_AND_ABOVE']),
      hateSpeech: z.enum(['BLOCK_NONE', 'BLOCK_LOW_AND_ABOVE', 'BLOCK_MEDIUM_AND_ABOVE', 'BLOCK_HIGH_AND_ABOVE']),
      sexuallyExplicit: z.enum(['BLOCK_NONE', 'BLOCK_LOW_AND_ABOVE', 'BLOCK_MEDIUM_AND_ABOVE', 'BLOCK_HIGH_AND_ABOVE']),
      dangerousContent: z.enum(['BLOCK_NONE', 'BLOCK_LOW_AND_ABOVE', 'BLOCK_MEDIUM_AND_ABOVE', 'BLOCK_HIGH_AND_ABOVE']),
      civicIntegrity: z.enum(['BLOCK_NONE', 'BLOCK_LOW_AND_ABOVE', 'BLOCK_MEDIUM_AND_ABOVE', 'BLOCK_HIGH_AND_ABOVE']),
    }),
  }),
  textEmbedding: z.object({
    model: z.enum(['gemini-embedding-001']),
    taskType: z.enum([
      'TASK_TYPE_UNSPECIFIED',
      'RETRIEVAL_QUERY',
      'RETRIEVAL_DOCUMENT',
      'SEMANTIC_SIMILARITY',
      'CLASSIFICATION',
      'CLUSTERING',
      'QUESTION_ANSWERING',
      'FACT_VERIFICATION',
      'CODE_RETRIEVAL_QUERY',
    ]),
    outputDimensionality: z.number().int().min(1).max(3072),
    autoEmbedding: z.boolean(),
    autoTruncate: z.boolean(),
    batchSize: z.number().int().min(1).max(100),
  }),
  retrieval: z.object({
    autoRag: z.boolean(),
    docTopK: z.number().min(1).max(100),
    chunkTopK: z.number().min(1).max(200),
    perDocChunkCap: z.number().min(1).max(20),
    contextWindow: z.number().min(0).max(5),
    minDocSim: z.number().min(0).max(1),
    minChunkSim: z.number().min(0).max(1),
    budgetTokens: z.number().min(1000).max(50000),
    strategy: z.enum(['balanced', 'aggressive', 'conservative']),
    addCitations: z.boolean(),
    semanticSearchLimit: z.number().int().min(100).max(5000),
    contentTruncateLength: z.number().int().min(100).max(10000),
  }),
  functionCalling: z.object({
    enabled: z.boolean(),
    maxPageSize: z.number().int().min(1).max(50),
    defaultPageSize: z.number().int().min(1).max(50),
    maxIterations: z.number().int().min(1).max(10),
    enablePagination: z.boolean(),
  }),
  chunking: z.object({
    chunkSize: z.number().int().min(256).max(8000),
    overlap: z.number().int().min(0).max(2000),
    enabled: z.boolean(),
  }),
});

type SettingsFormData = z.infer<typeof settingsFormSchema>;

export function Settings() {
  const { toast } = useToast();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch current settings
  const { data: config, isLoading } = useQuery<AppConfig>({
    queryKey: ['/api/settings'],
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: UpdateAppConfig) => {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update settings');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      setHasUnsavedChanges(false);
      toast({
        title: 'Settings saved',
        description: 'Your configuration has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Save failed',
        description: error.message || 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      geminiApi: {
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        topP: 0.94,
        topK: 32,
        maxOutputTokens: 1000,
        systemInstructions: 'You are a helpful AI assistant for object and context management. Objects refer to all types of data entries including but not limited to persons, entities, issues, logs, meetings, letters, and documents.',
        safetySettings: {
          harassment: 'BLOCK_NONE',
          hateSpeech: 'BLOCK_NONE',
          sexuallyExplicit: 'BLOCK_NONE',
          dangerousContent: 'BLOCK_NONE',
          civicIntegrity: 'BLOCK_NONE',
        },
      },
      textEmbedding: {
        model: 'gemini-embedding-001',
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: 3072,
        autoEmbedding: true,
        autoTruncate: true,
        batchSize: 10,
      },
      retrieval: {
        autoRag: true,
        docTopK: 30,
        chunkTopK: 90,
        perDocChunkCap: 6,
        contextWindow: 1,
        minDocSim: 0.25,
        minChunkSim: 0.30,
        budgetTokens: 12000,
        strategy: 'balanced',
        addCitations: true,
        semanticSearchLimit: 1000,
        contentTruncateLength: 1000,
      },
      functionCalling: {
        enabled: true,
        maxPageSize: 50,
        defaultPageSize: 20,
        maxIterations: 5,
        enablePagination: true,
      },
      chunking: {
        chunkSize: 2000,
        overlap: 200,
        enabled: true,
      },
    },
  });

  // Reset form when config loads
  useEffect(() => {
    if (config) {
      form.reset(config);
      setHasUnsavedChanges(false);
    }
  }, [config, form]);

  // Watch for changes
  useEffect(() => {
    const subscription = form.watch(() => {
      if (config) {
        setHasUnsavedChanges(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, config]);

  const onSubmit = (data: SettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  const resetToDefaults = () => {
    if (config) {
      form.reset(config);
      setHasUnsavedChanges(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
            <p className="text-muted-foreground">Configure your AI assistant and embedding settings</p>
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetToDefaults}
                data-testid="button-reset-settings"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            )}
            <Button
              onClick={form.handleSubmit(onSubmit)}
              disabled={!hasUnsavedChanges || updateSettingsMutation.isPending}
              data-testid="button-save-settings"
            >
              {updateSettingsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Theme Settings */}
            <Card data-testid="card-theme-settings">
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the look and feel of the application</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Theme</p>
                    <p className="text-sm text-muted-foreground">Switch between light and dark modes</p>
                  </div>
                  <ThemeToggle />
                </div>
              </CardContent>
            </Card>

            {/* Gemini API Settings */}
            <Card data-testid="card-gemini-settings">
              <CardHeader>
                <CardTitle>Gemini AI Configuration</CardTitle>
                <CardDescription>
                  Configure Gemini AI model parameters for conversations and function calling
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="geminiApi.model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-gemini-model">
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                            <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>Choose the Gemini model variant</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="geminiApi.temperature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temperature</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="2"
                            data-testid="input-temperature"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>Controls randomness (0.0-2.0)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="geminiApi.topP"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Top-P</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            data-testid="input-top-p"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>Nucleus sampling (0.0-1.0)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="geminiApi.topK"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Top-K</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="40"
                            data-testid="input-top-k"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>Top-k sampling (1-40)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="geminiApi.maxOutputTokens"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Output Tokens</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="8192"
                          data-testid="input-max-output-tokens"
                          {...field}
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>Maximum tokens in response (1-8192)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="geminiApi.systemInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Instructions</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter system instructions for the AI assistant..."
                          className="min-h-[100px]"
                          data-testid="textarea-system-instructions"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Instructions that guide the AI's behavior</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div>
                  <h4 className="font-medium mb-3">Safety Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'harassment', label: 'Harassment' },
                      { key: 'hateSpeech', label: 'Hate Speech' },
                      { key: 'sexuallyExplicit', label: 'Sexually Explicit' },
                      { key: 'dangerousContent', label: 'Dangerous Content' },
                      { key: 'civicIntegrity', label: 'Civic Integrity' },
                    ].map(({ key, label }) => (
                      <FormField
                        key={key}
                        control={form.control}
                        name={`geminiApi.safetySettings.${key}` as any}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{label}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid={`select-safety-${key}`}>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="BLOCK_NONE">Block None</SelectItem>
                                <SelectItem value="BLOCK_LOW_AND_ABOVE">Block Low+</SelectItem>
                                <SelectItem value="BLOCK_MEDIUM_AND_ABOVE">Block Medium+</SelectItem>
                                <SelectItem value="BLOCK_HIGH_AND_ABOVE">Block High+</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Text Embedding Settings */}
            <Card data-testid="card-embedding-settings">
              <CardHeader>
                <CardTitle>Text Embedding Configuration</CardTitle>
                <CardDescription>
                  Configure text embedding settings for object similarity and context matching
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="textEmbedding.model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Embedding Model</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-embedding-model">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="gemini-embedding-001">Gemini Embedding 001</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>Embedding model for text processing</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="textEmbedding.taskType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Task Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-task-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="TASK_TYPE_UNSPECIFIED">Unspecified</SelectItem>
                            <SelectItem value="RETRIEVAL_QUERY">Retrieval Query</SelectItem>
                            <SelectItem value="RETRIEVAL_DOCUMENT">Retrieval Object</SelectItem>
                            <SelectItem value="SEMANTIC_SIMILARITY">Semantic Similarity</SelectItem>
                            <SelectItem value="CLASSIFICATION">Classification</SelectItem>
                            <SelectItem value="CLUSTERING">Clustering</SelectItem>
                            <SelectItem value="QUESTION_ANSWERING">Question Answering</SelectItem>
                            <SelectItem value="FACT_VERIFICATION">Fact Verification</SelectItem>
                            <SelectItem value="CODE_RETRIEVAL_QUERY">Code Retrieval Query</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>Embedding task optimization</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="textEmbedding.outputDimensionality"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Output Dimensionality</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="3072"
                            data-testid="input-output-dimensionality"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>Embedding vector dimensions (1-3072)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="textEmbedding.batchSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Batch Size</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            data-testid="input-batch-size"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>Processing batch size (1-100)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="textEmbedding.autoEmbedding"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Auto Embedding</FormLabel>
                          <FormDescription>
                            Automatically generate embeddings for new objects
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-auto-embedding"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="textEmbedding.autoTruncate"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Auto Truncate</FormLabel>
                          <FormDescription>
                            Automatically truncate text that exceeds model limits
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-auto-truncate"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Retrieval Settings */}
            <Card data-testid="card-retrieval-settings">
              <CardHeader>
                <CardTitle>智能檢索設定</CardTitle>
                <CardDescription>
                  配置自動文檔檢索和上下文生成的參數設定
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="retrieval.autoRag"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">自動文檔檢索</FormLabel>
                        <FormDescription>
                          在對話時自動檢索相關文檔作為上下文
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-auto-rag"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="retrieval.docTopK"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>文檔檢索上限</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            data-testid="input-doc-top-k"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>每次檢索的最大文檔數量 (1-100)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retrieval.chunkTopK"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>文檔塊檢索上限(chunkTopK)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="200"
                            data-testid="input-chunk-top-k"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>每次檢索的最大文檔塊數量 (1-200)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retrieval.budgetTokens"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token 預算</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1000"
                            max="50000"
                            data-testid="input-budget-tokens"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>上下文的最大 Token 數量 (1000-50000)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retrieval.strategy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>檢索策略</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-retrieval-strategy">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="balanced">平衡</SelectItem>
                            <SelectItem value="aggressive">積極</SelectItem>
                            <SelectItem value="conservative">保守</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>選擇檢索策略的積極程度</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retrieval.minDocSim"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>文檔相似度門檻</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            data-testid="input-min-doc-sim"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>文檔相似度的最低門檻 (0.0-1.0)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retrieval.minChunkSim"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>文檔塊相似度門檻</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            data-testid="input-min-chunk-sim"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>文檔塊相似度的最低門檻 (0.0-1.0)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                  <FormField
                    control={form.control}
                    name="retrieval.semanticSearchLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>語意搜尋結果上限(semanticSearchLimit)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="100"
                            max="5000"
                            data-testid="input-semantic-search-limit"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>語意搜尋時的最大候選結果數量 (100-5000)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retrieval.contentTruncateLength"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>文檔內容截斷長度(contentTruncateLength)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="100"
                            max="10000"
                            data-testid="input-content-truncate-length"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>搜尋結果中文檔內容的最大顯示長度 (100-10000)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retrieval.addCitations"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">添加引用</FormLabel>
                          <FormDescription>
                            在回應中自動添加文檔引用資訊
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-add-citations"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
              </CardContent>
            </Card>

            {/* Function Calling Settings */}
            <Card data-testid="card-function-calling-settings">
              <CardHeader>
                <CardTitle>Function Calling 設定</CardTitle>
                <CardDescription>
                  配置 AI 函數調用和分頁搜索的參數設定
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="functionCalling.enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">啟用 Function Calling</FormLabel>
                        <FormDescription>
                          允許 AI 調用搜索和檢索函數
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-function-calling-enabled"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="functionCalling.defaultPageSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>預設分頁大小</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="50"
                            data-testid="input-default-page-size"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>每頁顯示的搜索結果數量 (1-50)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="functionCalling.maxPageSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>最大分頁大小</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="50"
                            data-testid="input-max-page-size"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>單頁搜索結果的最大限制 (1-50)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="functionCalling.maxIterations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>最大迭代次數</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            data-testid="input-max-iterations"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>單次對話的最大函數調用次數 (1-10)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="functionCalling.enablePagination"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">啟用分頁搜索</FormLabel>
                        <FormDescription>
                          允許 AI 使用分頁進行多輪搜索以獲得更多結果
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-enable-pagination"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Chunking Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>文檔切片設定</CardTitle>
                <CardDescription>
                  配置文檔切片的大小、重疊和啟用狀態參數
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="chunking.enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">啟用文檔切片</FormLabel>
                        <FormDescription>
                          啟用後文檔會被分割成小片段來提高搜尋準確度
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-enable-chunking"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="chunking.chunkSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>切片大小 (字符數)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="256"
                            max="8000"
                            data-testid="input-chunk-size"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>每個文檔切片的字符數量 (256-8000)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="chunking.overlap"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>重疊長度 (字符數)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="2000"
                            data-testid="input-chunk-overlap"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>相鄰切片間的重疊字符數量 (0-2000)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </div>
  );
}