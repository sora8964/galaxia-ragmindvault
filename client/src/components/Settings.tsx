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
        systemInstructions: 'You are a helpful AI assistant for document and context management.',
        safetySettings: {
          harassment: 'BLOCK_MEDIUM_AND_ABOVE',
          hateSpeech: 'BLOCK_MEDIUM_AND_ABOVE',
          sexuallyExplicit: 'BLOCK_MEDIUM_AND_ABOVE',
          dangerousContent: 'BLOCK_MEDIUM_AND_ABOVE',
          civicIntegrity: 'BLOCK_MEDIUM_AND_ABOVE',
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  Configure text embedding settings for document similarity and context matching
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-task-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="TASK_TYPE_UNSPECIFIED">Unspecified</SelectItem>
                            <SelectItem value="RETRIEVAL_QUERY">Retrieval Query</SelectItem>
                            <SelectItem value="RETRIEVAL_DOCUMENT">Retrieval Document</SelectItem>
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
                            Automatically generate embeddings for new documents
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
          </form>
        </Form>
      </div>
    </div>
  );
}